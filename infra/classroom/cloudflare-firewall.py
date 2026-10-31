#!/usr/bin/env python3
"""Refresh HTTPS origin allowlists from Cloudflare; never broaden on a bad response."""
import ipaddress
import json
import pathlib
import subprocess
import urllib.request

def validated_ranges(document):
    ranges = []
    if document.get('success') is not True:
        raise ValueError('Cloudflare API unavailable; previous firewall preserved')
    for version in (4, 6):
        nets = [ipaddress.ip_network(line.strip(), strict=True) for line in document['result'][f'ipv{version}_cidrs']]
        if not 5 <= len(nets) <= 100 or len(set(nets)) != len(nets):
            raise ValueError('Unexpected Cloudflare network list; previous firewall preserved')
        for net in nets:
            if net.version != version or not net.is_global or net.prefixlen < (12 if version == 4 else 28):
                raise ValueError('Unsafe network; previous firewall preserved')
        ranges.extend(str(net) for net in nets)
    return ranges


def main():
    request = urllib.request.Request('https://api.cloudflare.com/client/v4/ips', headers={'User-Agent': 'Lessonara-origin-firewall/1.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=20) as response:
        document = json.loads(response.read(32768))
    ranges = validated_ranges(document)
    state = pathlib.Path("/var/lib/lessonara-operations")
    state.mkdir(mode=0o750, exist_ok=True)
    previous = json.loads((state/'cloudflare-ranges.json').read_text()) if (state/'cloudflare-ranges.json').exists() else []
    for net in ranges:
        subprocess.run(['ufw','allow','from',net,'to','any','port','443','proto','tcp','comment','Lessonara Cloudflare HTTPS'],check=True,stdout=subprocess.DEVNULL)
    for net in set(previous)-set(ranges):
        subprocess.run(['ufw','--force','delete','allow','from',net,'to','any','port','443','proto','tcp'],check=True,stdout=subprocess.DEVNULL)
    (state/'cloudflare-ranges.json.tmp').write_text(json.dumps(ranges))
    (state/'cloudflare-ranges.json.tmp').replace(state/'cloudflare-ranges.json')
    print('Cloudflare HTTPS allowlist validated and refreshed')


if __name__ == "__main__":
    main()
