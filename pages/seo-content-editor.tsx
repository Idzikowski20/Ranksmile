import type { NextPage } from 'next';
import { ContentEditorPage } from '../components/contentEditor/ContentEditorPage';

// Public marketing page — no auth gate (registered in lib/isPublicPath + accessPolicy).
// `/content-editor` itself is the app rewrite to /articles, hence this slug.
const SeoContentEditor: NextPage = () => <ContentEditorPage />;
export default SeoContentEditor;
