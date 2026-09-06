import pexpect, json, time

cmd = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'cat /home/megaunlockphone-panel/www/data/orders.json 2>/dev/null | head -c 50000'"
child = pexpect.spawn(cmd, encoding='utf-8')
i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=15)
data = child.before
# Find orders for service 154
try:
    start = data.find('[')
    if start >= 0:
        orders = json.loads(data[start:].strip())
        for o in orders:
            if str(o.get('serviceid')) == '154' or str(o.get('serviceId')) == '154':
                print(json.dumps(o, indent=2, ensure_ascii=False))
                print('---')
        print(f'Total orders: {len(orders)}')
    else:
        print('No JSON array found')
except Exception as e:
    print(f'Error: {e}')
    print(data[-500:])
