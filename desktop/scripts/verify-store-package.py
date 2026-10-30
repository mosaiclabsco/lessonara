"""Validate Store identity and native protocol/capabilities before manual upload."""
import os
from pathlib import PurePosixPath
import sys
import xml.etree.ElementTree as ET
import zipfile

N = {'p': 'http://schemas.microsoft.com/appx/manifest/foundation/windows10',
     'uap': 'http://schemas.microsoft.com/appx/manifest/uap/windows10'}

def verify(path, env=os.environ):
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read('AppxManifest.xml'))
        identity = root.find('p:Identity', N)
        if identity is None:
            raise ValueError('Missing package identity')
        for attr, key in [('Name', 'STORE_IDENTITY_NAME'), ('Publisher', 'STORE_PUBLISHER')]:
            if not env.get(key) or identity.get(attr) != env[key].strip():
                raise ValueError('Package identity does not match ' + key)
        display = root.find('p:Properties/p:PublisherDisplayName', N)
        if display is None or display.text != env.get('STORE_PUBLISHER_DISPLAY_NAME', '').strip():
            raise ValueError('Publisher display name does not match Partner Center')
        apps = root.findall('p:Applications/p:Application', N)
        if len(apps) != 1 or apps[0].get('Id') != 'Lessonara' or apps[0].get('EntryPoint') != 'Windows.FullTrustApplication':
            raise ValueError('Unexpected application entry point')
        executable = apps[0].get('Executable', '').replace('\\', '/')
        if not executable or '..' in PurePosixPath(executable).parts or executable not in archive.namelist():
            raise ValueError('Application executable is missing from package')
        protocols = [item.get('Name') for item in apps[0].findall('.//uap:Protocol', N)]
        if protocols != ['lessonara']:
            raise ValueError('Missing or unexpected protocol registration')
        capabilities = root.find('p:Capabilities', N)
        names = {item.get('Name') for item in capabilities} if capabilities is not None else set()
        if names != {'runFullTrust', 'internetClient', 'webcam', 'microphone'}:
            raise ValueError('Unexpected media or system capabilities')
        languages = {item.get('Language') for item in root.findall('p:Resources/p:Resource', N)}
        if languages != {'pt-BR', 'en-US', 'es-ES', 'fr-FR'}:
            raise ValueError('Unexpected package languages')

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: verify-store-package.py package.appx')
    verify(sys.argv[1])
    print('Store package identity, executable, protocol, media capabilities and languages verified.')
