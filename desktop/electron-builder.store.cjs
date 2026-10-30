const base = require('./electron-builder.windows.cjs');

module.exports = function storeConfig(_context, env = process.env) {
  const identityName = env.STORE_IDENTITY_NAME?.trim();
  const publisher = env.STORE_PUBLISHER?.trim();
  const publisherDisplayName = env.STORE_PUBLISHER_DISPLAY_NAME?.trim();
  if (!identityName || !/^[A-Za-z0-9][A-Za-z0-9.-]{2,49}$/.test(identityName))
    throw new Error('STORE_IDENTITY_NAME must match Package/Identity/Name from Partner Center.');
  if (!publisher || !/^CN=[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(publisher))
    throw new Error('STORE_PUBLISHER must match Package/Identity/Publisher from Partner Center.');
  if (!publisherDisplayName || publisherDisplayName.length > 256 || /[\u0000-\u001f\u007f]/.test(publisherDisplayName))
    throw new Error('STORE_PUBLISHER_DISPLAY_NAME must match the publisher display name from Partner Center.');
  const { nsis, ...shared } = base;
  return {
    ...shared,
    directories: { output: 'out/store' },
    files: [...base.files, '!electron-builder.store.cjs'],
    win: { ...base.win, target: [{ target: 'appx', arch: ['x64'] }], signAndEditExecutable: false },
    appx: {
      identityName, publisher, publisherDisplayName,
      applicationId: 'Lessonara', displayName: 'Lessonara',
      artifactName: 'Lessonara-${version}-store-${arch}.${ext}',
      languages: ['pt-BR', 'en-US', 'es-ES', 'fr-FR'],
      capabilities: ['runFullTrust', 'internetClient', 'webcam', 'microphone'],
      minVersion: '10.0.19041.0', maxVersionTested: '10.0.26100.0',
      addAutoLaunchExtension: false, setBuildNumber: false,
    },
  };
};
