import ArticlePage from '@/site/article';
import { TERMS } from '@/content/legal';
import React from 'react';

export default function Page() {
    return <ArticlePage doc={TERMS} />;
}
