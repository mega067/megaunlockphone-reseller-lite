import pexpect, json

cmd = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'cat /home/megaunlockphone-panel/www/data/history.json'"
child = pexpect.spawn(cmd, encoding='utf-8', maxread=200000)
i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=30)
data = child.before
start = data.find('[')
if start < 0:
    start = data.find('{')
if start >= 0:
    try:
        orders = json.loads(data[start:].strip())
        if isinstance(orders, list):
            for o in orders:
                sid = str(o.get('serviceid', o.get('serviceId', o.get('service_id', ''))))
                if sid == '154':
                    print(json.dumps(o, indent=2, ensure_ascii=False)[:500])
                    print('---')
            # Also check for Free Fire
            for o in orders:
                sname = str(o.get('serviceName', o.get('service', '')))
                if 'free fire' in sname.lower() or 'freefire' in sname.lower():
                    print(json.dumps(o, indent=2, ensure_ascii=False)[:500])
                    print('===')
            print(f'Total history entries: {len(orders)}')
        else:
            print('Not a list, keys:', list(orders.keys())[:10])
    except Exception as e:
        print(f'Parse error: {e}')
        print(data[start:start+500])
else:
    print('No JSON found')
    print(data[-500:])
