import dynamic from 'next/dynamic';

const PixabayImageModal = dynamic(() => import('../PixabayImageModal'), { ssr: false });
const CompareVersionsModal = dynamic(() => import('../CompareVersionsModal'), { ssr: false });
const CustomizationPanelModal = dynamic(() => import('../CustomizationPanelModal'), { ssr: false });
export const VersionHistoryPanel = dynamic(() => import('../VersionHistoryPanel'), { ssr: false });

export interface ArticleEditorModalsProps {
  showPixabay: boolean;
  onClosePixabay: () => void;
  pixabayQuery: string;
  onPixabaySelect: (image: { url: string; alt: string; width: number; height: number }) => void;
  compareVersions: { original: string; updated: string } | null;
  onCloseCompareVersions: () => void;
  compareTerms: string[];
  showCustomization: boolean;
  onCloseCustomization: () => void;
  domainSlug: string | undefined;
  customizationKeyword: string;
}

export function ArticleEditorModals({
  showPixabay,
  onClosePixabay,
  pixabayQuery,
  onPixabaySelect,
  compareVersions,
  onCloseCompareVersions,
  compareTerms,
  showCustomization,
  onCloseCustomization,
  domainSlug,
  customizationKeyword,
}: ArticleEditorModalsProps) {
  return (
    <>
      {showPixabay && (
        <PixabayImageModal
          defaultQuery={pixabayQuery}
          onSelect={onPixabaySelect}
          onClose={onClosePixabay}
        />
      )}

      {compareVersions && (
        <CompareVersionsModal
          original={compareVersions.original}
          updated={compareVersions.updated}
          terms={compareTerms}
          onClose={onCloseCompareVersions}
        />
      )}

      <CustomizationPanelModal
        open={showCustomization}
        slug={domainSlug}
        keyword={customizationKeyword}
        onClose={onCloseCustomization}
      />
    </>
  );
}
