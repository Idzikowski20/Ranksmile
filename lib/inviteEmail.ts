export function inviteEmailHtml(p: { orgName: string; role: string; acceptUrl: string; expiresAt: string }): string {
   const article = /^[aeiou]/i.test(p.role) ? 'an' : 'a';
   return `
   <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#18181b">
     <h1 style="font-size:24px;line-height:1.3;font-weight:700;margin:0 0 24px">You've been invited to join ${escapeHtml(p.orgName)}</h1>
     <p style="font-size:15px;line-height:1.6;margin:0 0 24px">Click the button below to accept the invitation and join as ${article} ${escapeHtml(p.role)}:</p>
     <p style="margin:0 0 28px"><a href="${p.acceptUrl}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px">Accept invitation</a></p>
     <p style="font-size:14px;line-height:1.6;color:#52525c;margin:0 0 8px">If you're having trouble with the button above, copy and paste the URL below into your web browser:</p>
     <p style="font-size:14px;line-height:1.6;margin:0 0 24px"><a href="${p.acceptUrl}" style="color:#F29964;word-break:break-all">${p.acceptUrl}</a></p>
     <p style="font-size:14px;line-height:1.6;font-weight:600;margin:0 0 24px">The link is valid until ${escapeHtml(p.expiresAt)}.</p>
     <p style="font-size:14px;line-height:1.6;color:#52525c;margin:0">If you weren't expecting this invitation, you can disregard this email.</p>
   </div>`;
}

function escapeHtml(s: string): string {
   return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
