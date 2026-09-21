from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, UUID, Float
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

Base = declarative_base()


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), unique=True, nullable=False)
    # what each end of this topic's axis actually means. +5 is always the right
    # bloc's position, which for many topics is opposition to the thing named.
    pole_right = Column(String(64))
    pole_left = Column(String(64))

    articles = relationship("Article", back_populates="topic")


class SiteTopicPriorBias(Base):
    __tablename__ = "site_topic_prior_bias"

    site_id = Column(ForeignKey("sites.id"), primary_key=True)
    topic_id = Column(ForeignKey("topics.id"), primary_key=True)

    prior_bias = Column(Float, nullable=False, default=0.0)

    site = relationship("Site", back_populates="topic_biases")
    topic = relationship("Topic")


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), unique=True, nullable=False)
    domain = Column(String(256), unique=True)
    # articles are shown in Hebrew only, so anything else has to be translated
    # at ingest and must never lead a cluster
    language = Column(String(8), nullable=False, server_default="he")
    # the curated roster that the map draws. Ingest still reads every site, so the
    # feed keeps its breadth while the axes stay readable and deliberate.
    in_roster = Column(Boolean, nullable=False, server_default="false")
    bias_score = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

    articles = relationship(
        "Article",
        back_populates="site",
        lazy="selectin",
    )
    topic_biases = relationship("SiteTopicPriorBias", back_populates="site")


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    cluster_id = Column(Integer, ForeignKey("clusters.id", ondelete="CASCADE"))
    topic_id = Column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)

    header = Column(String(512), nullable=False)
    subheader = Column(String(2048), nullable=False)
    embedding = Column(Vector(768))
    link = Column(String(512), nullable=False)
    topic_name = Column(String(64), nullable=False)
    bias_score = Column(Integer, default=0)
    votes_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("cluster_id", "site_id"),
    )

    site = relationship(
        "Site",
        back_populates="articles",
        lazy="joined",
    )

    cluster = relationship(
        "Cluster",
        back_populates="articles",
        lazy="joined",
    )

    votes = relationship(
        "Vote",
        back_populates="article",
        lazy="selectin"
    )

    topic = relationship(
        "Topic",
        back_populates="articles"
    )


class Cluster(Base):
    __tablename__ = "clusters"

    id = Column(Integer, primary_key=True)
    centroid_embedding = Column(Vector(768), nullable=False)
    article_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
    last_updated = Column(DateTime, server_default=func.now(), nullable=False)

    articles = relationship(
        "Article",
        back_populates="cluster",
        lazy="selectin",
    )


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(124), nullable=False)
    name = Column(String(124), nullable=False)

    created_at = Column(DateTime, server_default=func.now())


class ClusterSummary(Base):
    """One AI summary per (cluster, bloc), kept for good.

    It used to live in a dict on the api process, so every restart threw the lot
    away and the next reader paid for them again - which is what exhausted the
    free quota. A summary of a given set of headlines never changes, so it is
    written once and redone only when more headlines join the story - which is what
    article_count, the number it was written from, is for.
    """
    __tablename__ = "cluster_summaries"

    cluster_id = Column(Integer, ForeignKey("clusters.id", ondelete="CASCADE"), primary_key=True)
    bloc = Column(String(8), primary_key=True)
    summary = Column(String(2048), nullable=False)
    article_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class TopicCorrection(Base):
    """A human saying "this article is about X, not what the model guessed".

    The embedding is copied off the article so a correction keeps teaching even if
    the article is deleted. New articles are matched against these before the
    zero-shot classifier runs - see worker/local_ingest.py.
    """
    __tablename__ = "topic_corrections"

    id = Column(Integer, primary_key=True)
    article_id = Column(Integer, ForeignKey("articles.id", ondelete="SET NULL"))
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    previous_topic_id = Column(Integer, ForeignKey("topics.id", ondelete="SET NULL"))
    embedding = Column(Vector(768), nullable=False)
    header = Column(String(512))
    created_at = Column(DateTime, server_default=func.now())


class ClusterMerge(Base):
    """A human saying "these two stories are the same story".

    Recorded as a labelled pair so the clustering threshold can be re-derived from
    real decisions rather than guessed.
    """
    __tablename__ = "cluster_merges"

    id = Column(Integer, primary_key=True)
    kept_cluster_id = Column(Integer)
    merged_cluster_id = Column(Integer)
    similarity = Column(Float)
    created_at = Column(DateTime, server_default=func.now())


class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), default=None)

    value = Column(Integer, nullable=False)
    anonymous_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(INET, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("article_id", "anonymous_id"),
        UniqueConstraint("article_id", "ip_address")
    )

    article = relationship("Article", back_populates="votes")
    # user = relationship("User", back_populates="")