import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('verify_store', Path(__file__).with_name('verify-store-package.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ENV = {'STORE_IDENTITY_NAME': '12345.TestLessonara',
       'STORE_PUBLISHER': 'CN=11111111-2222-3333-4444-555555555555',
       'STORE_PUBLISHER_DISPLAY_NAME': 'Test Publisher'}
MANIFEST = '''<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10" xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10" xmlns:r="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities">
<Identity Name="12345.TestLessonara" Publisher="CN=11111111-2222-3333-4444-555555555555"/>
<Properties><PublisherDisplayName>Test Publisher</PublisherDisplayName></Properties>
<Resources><Resource Language="pt-BR"/><Resource Language="en-US"/><Resource Language="es-ES"/><Resource Language="fr-FR"/></Resources>
<Capabilities><r:Capability Name="runFullTrust"/><Capability Name="internetClient"/><DeviceCapability Name="webcam"/><DeviceCapability Name="microphone"/></Capabilities>
<Applications><Application Id="Lessonara" EntryPoint="Windows.FullTrustApplication" Executable="app\\Lessonara.exe"><Extensions><uap:Extension Category="windows.protocol"><uap:Protocol Name="lessonara"/></uap:Extension></Extensions></Application></Applications></Package>'''

class StorePackageTest(unittest.TestCase):
    def check_package(self, manifest=MANIFEST, executable=True, env=ENV):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.appx'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('AppxManifest.xml', manifest)
                if executable:
                    archive.writestr('app/Lessonara.exe', b'test fixture only')
            module.verify(path, env)

    def test_accepts_complete_identity_bound_package(self):
        self.check_package()

    def test_rejects_other_publisher(self):
        with self.assertRaisesRegex(ValueError, 'STORE_PUBLISHER'):
            self.check_package(env={**ENV, 'STORE_PUBLISHER': 'CN=aaaaaaaa-2222-3333-4444-555555555555'})

    def test_rejects_missing_native_protocol(self):
        with self.assertRaisesRegex(ValueError, 'protocol'):
            self.check_package(MANIFEST.replace('Name="lessonara"', 'Name="other"'))

    def test_rejects_additional_system_permissions(self):
        with self.assertRaisesRegex(ValueError, 'capabilities'):
            self.check_package(MANIFEST.replace('</Capabilities>', '<Capability Name="privateNetworkClientServer"/></Capabilities>'))

    def test_rejects_missing_executable(self):
        with self.assertRaisesRegex(ValueError, 'executable'):
            self.check_package(executable=False)

if __name__ == '__main__':
    unittest.main()
