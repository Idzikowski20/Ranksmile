import React from 'react';

const SKELETON_COUNT = 5;

const Skeleton = () => (
   <>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
         <div
            key={`skel-${i}`}
            style={{
               display: 'flex',
               alignItems: 'center',
               borderBottom: i < SKELETON_COUNT - 1 ? '1px solid #F4F4F5' : 'none',
               minHeight: 72,
               background: '#fff',
               animation: 'skeletonPulse 1.5s ease-in-out infinite',
               animationDelay: `${i * 0.08}s`,
            }}
         >
            <div style={{ padding: '0 16px', borderRight: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
               <div style={{ width: 20, height: 20, borderRadius: 6, background: '#F0F0F4' }} />
            </div>
            <div style={{ padding: '12px 16px', flexGrow: 1, minWidth: 256, display: 'flex', flexDirection: 'column', gap: 6 }}>
               <div style={{ width: '60%', height: 14, borderRadius: 6, background: '#F0F0F4' }} />
               <div style={{ width: '40%', height: 12, borderRadius: 6, background: '#F5F5F9' }} />
            </div>
            <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 154, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
               <div style={{ width: 48, height: 14, borderRadius: 6, background: '#F0F0F4' }} />
            </div>
            <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 108, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
               <div style={{ width: 36, height: 14, borderRadius: 6, background: '#F5F5F9' }} />
            </div>
            <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 108, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
               <div style={{ width: 28, height: 14, borderRadius: 6, background: '#F5F5F9' }} />
            </div>
            <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 108, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
               <div style={{ width: 40, height: 14, borderRadius: 6, background: '#F5F5F9' }} />
            </div>
         </div>
      ))}
   </>
);

export default Skeleton;
