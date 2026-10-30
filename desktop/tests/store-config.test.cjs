const {test}=require('node:test');
const assert=require('node:assert/strict');
const config=require('../electron-builder.store.cjs');
const env={STORE_IDENTITY_NAME:'12345.TestLessonara',STORE_PUBLISHER:'CN=11111111-2222-3333-4444-555555555555',STORE_PUBLISHER_DISPLAY_NAME:'Test Publisher'};
test('Store packaging requires exact Partner Center identity instead of invented defaults',()=>{for(const key of Object.keys(env))assert.throws(()=>config(null,{...env,[key]:''}));for(const publisher of ['CN=Example','<Publisher>','CN=123'])assert.throws(()=>config(null,{...env,STORE_PUBLISHER:publisher}));});
test('Store package keeps native protocol, media and full trust without NSIS hooks or auto-publication',()=>{const value=config(null,env);assert.equal(value.appx.identityName,env.STORE_IDENTITY_NAME);assert.equal(value.appx.publisher,env.STORE_PUBLISHER);assert.deepEqual(value.protocols,[{name:'Lessonara',schemes:['lessonara']}]);assert.equal(value.win.target[0].target,'appx');assert.equal(value.nsis,undefined);assert.equal(value.publish,null);assert.deepEqual(value.appx.capabilities,['runFullTrust','internetClient','webcam','microphone']);});
