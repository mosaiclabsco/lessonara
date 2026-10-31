#!/usr/bin/env python3
"""Non-invasive external boundary checks for the dedicated classroom VPS."""
import argparse
import socket
import urllib.request

ORIGIN='13.140.235.111'
PORTS=(22,80,443,2019,2375,2376,5222,5269,5280,5347,5432,6379,8000,8080,8888,9099)


def reachable(port):
    try:
        with socket.create_connection((ORIGIN,port),timeout=1):
            return True
    except (TimeoutError,ConnectionRefusedError,OSError):
        return False


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--admin-network',action='store_true',help='Current source is the SSH allowlisted administration network')
    args=parser.parse_args()
    failed=[]
    for port in PORTS:
        opened=reachable(port)
        expected=port==80 or (port==22 and args.admin_network)
        print(f'TCP {port}: {"reachable" if opened else "blocked"}')
        if opened!=expected:failed.append(port)
    request=urllib.request.Request('https://meet.mosaic-labs.co/',headers={'User-Agent':'Lessonara-boundary-check/1.0'})
    with urllib.request.urlopen(request,timeout=15) as response:
        if response.status!=200:raise SystemExit('Public classroom HTTPS failed')
    print('Cloudflare HTTPS: 200')
    if failed:raise SystemExit('Unexpected reachability on ports: '+','.join(map(str,failed)))
    print('Expected classroom network boundary verified')


if __name__=='__main__':main()
