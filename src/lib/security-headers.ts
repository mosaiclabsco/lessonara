function httpsOrigin(value:string|undefined) {
  if(!value)return null;
  const url=new URL(value);
  if(url.protocol!=="https:")throw new Error("Integração exige origem HTTPS.");
  return url.origin;
}
export function securityHeaders(jitsiUrl?:string,supabaseUrl?:string,development=false) {
  const meet=httpsOrigin(jitsiUrl),supabase=httpsOrigin(supabaseUrl);
  const scripts=["'self'","'unsafe-inline'",...(development?["'unsafe-eval'"]:[]),...(meet?[meet]:[])].join(" ");
  const connections=["'self'",...(meet?[meet,meet.replace("https:","wss:")]:[]),...(supabase?[supabase,supabase.replace("https:","wss:")]:[])].join(" ");
  const mediaSources=["'self'","blob:",...(meet?[meet]:[])].join(" ");
  const csp=["default-src 'self'",`script-src ${scripts}`,"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self'",`connect-src ${connections}`,`frame-src 'self'${meet?` ${meet}`:""}`,`media-src ${mediaSources}`,"worker-src 'self' blob:","object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'none'"].join("; ");
  const devices=`(self${meet?` "${meet}"`:""})`;
  return [
    {key:"Content-Security-Policy",value:csp},
    {key:"X-Frame-Options",value:"DENY"},
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"Referrer-Policy",value:"no-referrer"},
    {key:"Permissions-Policy",value:`camera=${devices}, microphone=${devices}, display-capture=${devices}, geolocation=(), payment=(), usb=()`},
  ];
}
