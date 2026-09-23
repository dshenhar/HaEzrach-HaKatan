import LegalPage from '@/components/legalPage';
import { PRIVACY } from '@/content/legal';
import React from 'react';

export default function Page() {
    return <LegalPage doc={PRIVACY} />;
}
