import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../lib/errors';
import Modal from '../core/modal/modal';
import Button from '../core/button/button';

const F = 'var(--font-family-primary)';

interface Props {
  articleId: number;
  onClose: () => void;
}

const IcoX = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
);
const IcoCopy = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9 9 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9 9 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
);

const SocialMediaModal = ({ articleId, onClose }: Props) => {
  const [step, setStep] = useState<'intro' | 'variants'>('intro');
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);

  const generate = async () => {
    setStep('variants');
    setLoading(true);
    try {
      const res = await fetch('/api/articles/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not generate posts');
      const list: string[] = Array.isArray(data.variants) ? data.variants : [];
      if (!list.length) throw new Error('No posts were generated. Try again on a ready-to-publish article.');
      setVariants(list);
      setSelected(0);
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Could not generate posts');
      setStep('intro');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    const text = areaRef.current?.innerText?.trim();
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => toast.success('Copied to clipboard')).catch(() => toast.error('Copy failed'));
  };

  // Sync the editable area to the selected variant whenever it changes.
  useEffect(() => {
    if (areaRef.current && variants[selected] !== undefined) areaRef.current.innerHTML = variants[selected];
  }, [selected, variants]);

  return (
    <Modal onClose={onClose} width={step === 'intro' ? 600 : 800} closeOnOverlayClick>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 64px)', overflow: 'hidden', fontFamily: F }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 12px' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#18181b' }}>Create Post</h2>
          <Button type="button" variant="transparent" size="sm" onClick={onClose} aria-label="Close" icon={<IcoX />} />
        </div>

        {step === 'intro' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 24px 20px', fontSize: 14, lineHeight: '21px', color: '#3f3f47' }}>
              <span>Promoting your blog content on social media helps it rank higher.</span>
              <span>We&apos;ll generate 3 post variants to promote this article, using proven templates and your AI model. Run it on a ready-to-publish article.</span>
            </div>
            <div style={{ borderTop: '1px solid #f4f4f5', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="button" variant="primary" onClick={generate}>
                Generate Social Media Posts
              </Button>
            </div>
          </>
        )}

        {step === 'variants' && (
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 14 }} className="styled-scrollbar">
              <span style={{ fontSize: 14, color: '#52525c' }}>Pick the variant you like and publish it on social media.</span>

              {/* Variant selector */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                <span style={{ fontSize: 14, color: '#3f3f47' }}>Variants:</span>
                <div style={{ display: 'inline-flex', gap: 2, background: '#f4f4f5', borderRadius: 8, padding: 4 }}>
                  {[0, 1, 2].map((i) => {
                    const sel = selected === i;
                    const ready = !loading && variants[i] !== undefined;
                    return (
                      <Button
                        key={i}
                        type="button"
                        variant={sel ? 'primary' : 'transparent'}
                        size="sm"
                        disabled={!ready}
                        onClick={() => setSelected(i)}
                        style={{ width: 33, minWidth: 33, padding: '0 4px' }}
                      >
                        {i + 1}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Content area */}
              <div style={{ border: '1px solid #e4e4e7', borderRadius: 12, minHeight: 246, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {loading ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52525c', fontSize: 14, padding: 24 }}>Generating your content…</div>
                ) : (
                  <div
                    ref={areaRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="styled-scrollbar"
                    style={{ flex: 1, minHeight: 246, maxHeight: 360, overflowY: 'auto', padding: '14px 16px', outline: 'none', fontSize: 14, lineHeight: 1.7, color: '#374151' }}
                  />
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f4f4f5', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="primary"
                onClick={copy}
                disabled={loading || !variants.length}
                icon={<IcoCopy />}
              >
                Copy
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default SocialMediaModal;
