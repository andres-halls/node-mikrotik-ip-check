import http from 'http';
import MikroNode from 'splynx-mikronode-ng2';
import chalk from 'chalk-template';
import ip6addr from 'ip6addr';

const HOST = process.env.MIKROTIK_ADDRESS;
const PORT = process.env.MIKROTIK_API_PORT || 8728;
if (!HOST) throw new Error('MIKROTIK_ADDRESS missing from env!');
const USERNAME = process.env.MIKROTIK_USERNAME;
if (!USERNAME) throw new Error('MIKROTIK_USERNAME missing from env!');
const PASSWORD = process.env.MIKROTIK_PASSWORD;
if (!PASSWORD) throw new Error('MIKROTIK_PASSWORD missing from env!');
const LISTNAME = process.env.MIKROTIK_ADDRESS_LIST;
if (!LISTNAME) throw new Error('MIKROTIK_ADDRESS_LIST missing from env!');

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = req.headers['host'] + req.headers['x-original-uri'];
    let requestIp = req.headers['x-real-ip'] || req.connection.remoteAddress;
    requestIp = ip6addr.parse(requestIp);
    const options = {PORT, closeOnDone: true, timeout: 5, closeOnTimeout: true};
    const connection = MikroNode.getConnection(HOST, USERNAME, PASSWORD, options);
    const conn = await connection.getConnectPromise();
    let ipv4List = conn.getCommandPromise('/ip/firewall/address-list/print');
    let ipv6List = conn.getCommandPromise('/ipv6/firewall/address-list/print');
    [ipv4List, ipv6List] = await Promise.all([ipv4List, ipv6List]);
    ipv4List = ipv4List
      .filter(ip => ip.list === LISTNAME && ip.disabled === 'false')
      .map(ip => ip6addr.parse(ip.address))
    ipv6List = ipv6List
      .filter(ip => ip.list === LISTNAME && ip.disabled === 'false')
      .map(ip => ip6addr.createCIDR(ip.address));

    let allowed = false;

    if (requestIp.kind() === 'ipv4') {
      allowed = ipv4List.some(ip => ip.compare(requestIp) === 0);
    } else if (requestIp.kind() === 'ipv6') {
      allowed = ipv6List.some(cidr => cidr.contains(requestIp));
    } else {
      throw new Error('Request IP has unknown kind.');
    }

    if (allowed) {
      res.statusCode = 200;
      return res.end();
    }

    console.log(chalk`{red [!]} IP {bold ${requestIp}} not allowed.`);
    console.log(`\tRequested URL: ${requestUrl}`);
    res.statusCode = 403;
    res.end();
  } catch (err) {
    console.error(err.toString());
    res.statusCode = 500;
    res.end();
  }
});

server.listen(process.env.PORT || 8888, (err) => {
  if (err) return console.error(err);
  const port = server.address().port;
  console.log('Server listening on port %s.', port);
});
