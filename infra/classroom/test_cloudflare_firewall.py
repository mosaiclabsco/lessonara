import copy
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('firewall',Path(__file__).with_name('cloudflare-firewall.py'))
firewall=importlib.util.module_from_spec(spec)
spec.loader.exec_module(firewall)
GOOD={'success':True,'result':{'ipv4_cidrs':['173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22','141.101.64.0/18'],'ipv6_cidrs':['2400:cb00::/32','2606:4700::/32','2803:f800::/32','2405:b500::/32','2405:8100::/32']}}

class FirewallValidation(unittest.TestCase):
    def test_known_public_networks(self):
        self.assertEqual(len(firewall.validated_ranges(GOOD)),10)

    def test_api_failure_preserves_rules(self):
        with self.assertRaises(ValueError):firewall.validated_ranges({'success':False})

    def test_bad_networks_never_reach_mutation(self):
        for bad in ['0.0.0.0/0','10.0.0.0/8','127.0.0.0/8','::/0','2400:cb00::/32','not-a-network','173.245.48.1/20']:
            data=copy.deepcopy(GOOD);data['result']['ipv4_cidrs'][0]=bad
            with self.subTest(bad=bad),self.assertRaises(ValueError):firewall.validated_ranges(data)

    def test_truncated_or_duplicate_lists(self):
        for field in ['ipv4_cidrs','ipv6_cidrs']:
            data=copy.deepcopy(GOOD);data['result'][field]=data['result'][field][:1]
            with self.assertRaises(ValueError):firewall.validated_ranges(data)
            data=copy.deepcopy(GOOD);data['result'][field][0]=data['result'][field][1]
            with self.assertRaises(ValueError):firewall.validated_ranges(data)

if __name__=='__main__':unittest.main()
