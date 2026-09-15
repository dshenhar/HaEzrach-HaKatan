import random
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from datetime import datetime, timedelta
from transformers import pipeline
import joblib
import json
import threading
from db.models import Cluster, Article, Site, Topic
from sqlalchemy import func, cast
from pgvector.sqlalchemy import Vector


SAME_ARTICLE_THRESHOLD = 0.97
lock = threading.Lock()

topics = [
        "two-state",
        "annexation-area-c",
        "divide-jerusalem",
        "targeted-killings",
        "settlements-building",
        "outpost-evacuation",
        "settlement-evacuation",
        "deal-of-the-century",
        "nation-state-law",
        "economic-system",
        "welfare-benefits",
        "yeshiva-funding",
        "public-housing",
        "core-studies",
        "haredi-draft",
        "civil-marriage",
        "same-sex-marriage",
        "environment",
        "migrant-workers",
        "judicial-independence",
        "cannabis-legalization",
        "conversion-therapy-ban"
    ]


def _get_position_by_rank(topic, site):
    with open("../../../research/initial_ranks.json", "r", encoding="utf-8") as f:
        ranks_by_topic = json.load(f)

    for entry in ranks_by_topic:
        if entry["category"] == topic:
            return entry["ranks"][site]
    return 0


class NewsClusterer:
    def __init__(self, model_name, similarity_threshold=0.8, time_window_hours=3, last_check=None):
        self.model = SentenceTransformer(model_name)
        self.classifier = pipeline("text-classification", model="/app/hebrew_classifier", tokenizer="/app/hebrew_classifier")
        self.label_encoder = joblib.load("/app/hebrew_classifier/label_encoder.pkl")
        # self.classifier = pipeline("zero-shot-classification", model="joeddav/xlm-roberta-large-xnli", tokenizer="joeddav/xlm-roberta-large-xnli", use_fast=False)
        self.similarity_threshold = similarity_threshold
        self.time_window = timedelta(hours=time_window_hours)
        self.last_check = last_check
        self.model_name = model_name

    def _encode(self, text):
        return self.model.encode(text, convert_to_numpy=True, normalize_embeddings=True)

    def _add_cluster(self, article, centroid_embedding, session):
        new_cluster = Cluster(
            centroid_embedding=centroid_embedding,
            article_count=1,
            created_at=datetime.now(),
            last_updated=datetime.now()
        )

        session.add(new_cluster)
        session.flush()
        article.cluster_id = new_cluster.id
        session.commit()

    def add_article(self, article, session):
        """
        Add an article (title+lead). timestamp should be datetime.
        If None, defaults to now().
        Returns cluster_id the article belongs to.
        """
        text = f"{article.header}\n{article.subheader}"

        topic_pred = self.classifier(text)[0]
        topic_id = int(topic_pred["label"].split("_")[-1])
        topic_name = self.label_encoder.inverse_transform([topic_id])[0]
        article.topic_name = topic_name
        topic_id = session.query(Topic.id).filter(Topic.name == topic_name).first()[0]
        article.topic_id = topic_id

        article_embedding = self._encode(text)
        # vecs = [self._encode(item['title']), self._encode(item['description']), self._encode(text)]

        twelve_hours_ago = article.created_at - self.time_window
        article.embedding = article_embedding
        session.commit()
        best_cluster = (session.query(Cluster).
                        filter(Cluster.created_at >= twelve_hours_ago).
                        order_by(func.cosine_distance(Cluster.centroid_embedding, cast(article_embedding, Vector(768)))).
                        limit(1)).one_or_none()
        if best_cluster:
            best_score = cosine_similarity([article_embedding], [best_cluster.centroid_embedding])[0, 0]
        else:
            best_score = 0
        if not best_cluster or best_score < self.similarity_threshold:
            self._add_cluster(article, article_embedding, session)
            return
        returned_article = self._look_for_candidate(best_cluster, article, article_embedding, best_score, session)
        if returned_article:
            print("re adding old article")
            self.add_article(returned_article, session)

    def _add_article_to_cluster(self, best_cluster, article, article_embedding, session):
        article.cluster_id = best_cluster.id
        best_cluster.last_updated = max(article.created_at, best_cluster.last_updated)
        best_cluster.article_count += 1
        best_cluster.centroid_embedding = ((best_cluster.centroid_embedding * (best_cluster.article_count-1)) + article_embedding) / best_cluster.article_count
        session.commit()

    def _replace_article_in_cluster(self, best_cluster, article, article_embedding, candidate, candidate_embedding, session):
        print("same article replaced")
        print(f"previous article:\n{candidate.header}\n{candidate.subheader}\n")
        print(f"new article:\n{article.header}\n{article.subheader}\n")
        article.cluster_id = best_cluster.id
        candidate.cluster_id = None
        best_cluster.last_updated = max(article.created_at, best_cluster.last_updated)
        best_cluster.centroid_embedding = ((best_cluster.centroid_embedding * best_cluster.article_count) + article_embedding - candidate_embedding) / best_cluster.article_count
        # print(best_cluster.centroid_embedding)
        try:
            session.commit()
        except Exception as e:
            print(f"failed to commit changes: {e}")

    def _look_for_candidate(self, best_cluster, article, article_embedding, article_score, session):
        site_id = article.site_id
        candidate = session.query(Article).filter(Article.cluster_id == best_cluster.id, Article.site_id == site_id).first()
        if not candidate:
            self._add_article_to_cluster(best_cluster, article, article_embedding, session)
            return None

        candidate_embedding = candidate.embedding
        # check if it is the same article that got missed
        articles_similarity = cosine_similarity([candidate_embedding], [article_embedding])[0, 0]
        if articles_similarity > SAME_ARTICLE_THRESHOLD:
            if article.created_at > candidate.created_at:
                self._replace_article_in_cluster(best_cluster, article, article_embedding, candidate, candidate_embedding, session)
            return None

        candidate_similarity = cosine_similarity([candidate_embedding], [best_cluster.centroid_embedding])[0, 0]
        if article_score > candidate_similarity:
            self._replace_article_in_cluster(best_cluster, article, article_embedding, candidate, candidate_embedding, session)
            return candidate
        else:
            print("current article is better, opening new cluster")
            self._add_cluster(article, article_embedding, session)
            return None



# ========== option for better clustering by the best on three embeddings: only header, only subheader, both ==========
# best_cluster = None
# best_score = 0.0
# vec = None
# if not candidate_clusters:
#     vec = vecs[-1]
# else:
#     best_clusters = [None, None, None]
#     best_scores = [0.0, 0.0, 0.0]
#     for index, cluster in enumerate(candidate_clusters):
#         for i in range(len(vecs)):
#             score = cosine_similarity([vecs[i]], [cluster["centroid"]])[0, 0]
#             if score > best_scores[i]:
#                 best_scores[i] = score
#                 best_clusters[i] = index
#
#     clusters_votes = {}
#     best_cluster_count = 0
#     for i, (c, score, vec) in enumerate(zip(best_clusters, best_scores, vecs)):
#         clusters_votes[c] = clusters_votes.get(c, []) + [i]
#         if len(clusters_votes[c]) > best_cluster_count:
#             best_cluster_count = len(clusters_votes[c])
#
#     for c, voters in clusters_votes.items():
#         if len(voters) == best_cluster_count:
#             scores = [best_scores[voter] for voter in voters]
#             best_index = np.argmax(scores)
#             best_score_vote = best_scores[best_index]
#             if best_score_vote > best_score:
#                 best_score = best_score_vote
#                 best_cluster = candidate_clusters[best_clusters[best_index]]
#                 vec = vecs[best_index]
#
# assign to cluster or create new