import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * The page every web route is served inside. Expo generates this file's markup at
 * export time, so whatever goes in the head here is in the HTML a link preview
 * reads - which is how a message with the address shows the name, the line and the
 * picture instead of a bare link.
 */
const SITE = 'https://haezrach-hakatan.web.app';
const TITLE = 'חדשות האזרח הקטן';
const DESCRIPTION =
    'כל החדשות, משני צדי המפה. כל סיפור מובא כפי שסיפרו אותו גופי הימין וגופי השמאל, עם סיכום לכל צד.';

export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="he" dir="rtl">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

                <title>{TITLE}</title>
                <meta name="description" content={DESCRIPTION} />
                <meta name="theme-color" content="#f8f8f8" />

                {/* what WhatsApp, Telegram, Slack and Facebook read */}
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content={TITLE} />
                <meta property="og:title" content={TITLE} />
                <meta property="og:description" content={DESCRIPTION} />
                <meta property="og:url" content={SITE} />
                <meta property="og:locale" content="he_IL" />
                <meta property="og:image" content={`${SITE}/og.png`} />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:image:alt" content="חמישה אנשים סביב שולחן, כל אחד עם עיתון אחר" />

                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={TITLE} />
                <meta name="twitter:description" content={DESCRIPTION} />
                <meta name="twitter:image" content={`${SITE}/og.png`} />

                {/* the native scroll of the page, off - the app does its own scrolling */}
                <ScrollViewStyleReset />
                <style dangerouslySetInnerHTML={{ __html: `body { background-color: #f8f8f8; }` }} />
            </head>
            <body>{children}</body>
        </html>
    );
}
