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

let addressListCache = {stale: true};

const server = http.createServer(async (req, res) => {
  try {
    const {ipv4List, ipv6List} = await getAddressLists();
    const requestUrl = req.headers['host'] + req.headers['x-original-uri'];
    let requestIP = req.headers['x-real-ip'] || req.connection.remoteAddress;
    requestIP = ip6addr.parse(requestIP);
    let allowed = false;

    if (requestIP.kind() === 'ipv4') {
      allowed = ipv4List.some(ip => ip.compare(requestIP) === 0);
    } else if (requestIP.kind() === 'ipv6') {
      allowed = ipv6List.some(cidr => cidr.contains(requestIP));
    } else {
      throw new Error('Request IP has unknown kind.');
    }

    if (allowed) {
      res.statusCode = 200;
      return res.end();
    }

    console.log(chalk`{red [!]} IP {bold ${requestIP}} not allowed.`);
    console.log(`\tRequested URL: ${requestUrl}`);
    res.statusCode = 403;
    res.end();
  } catch (err) {
    console.error(err.stack);
    res.statusCode = 500;
    res.end();
  }
});

async function getAddressLists() {
  if (!addressListCache.stale) {
    return {
      ipv4List: addressListCache.ipv4List,
      ipv6List: addressListCache.ipv6List
    };
  }

  const options = {PORT, closeOnDone: true, timeout: 5, closeOnTimeout: true};
  const connection = MikroNode.getConnection(HOST, USERNAME, PASSWORD, options);
  const conn = await connection.getConnectPromise();
  let ipv4List = conn.getCommandPromise('/ip/firewall/address-list/print');
  let ipv6List = conn.getCommandPromise('/ipv6/firewall/address-list/print');
  [ipv4List, ipv6List] = await Promise.all([ipv4List, ipv6List]);

  ipv4List = ipv4List
    .filter(ip => ip.list === LISTNAME && ip.disabled === 'false')
    .filter(ip => {
      try {
        ip6addr.parse(ip.address);
        return true;
      } catch (err) {
        return false;
      }
    })
    .map(ip => ip6addr.parse(ip.address));

  ipv6List = ipv6List
    .filter(ip => ip.list === LISTNAME && ip.disabled === 'false')
    .filter(ip => {
      try {
        ip6addr.createCIDR(ip.address);
        return true;
      } catch (err) {
        return false;
      }
    })
    .map(ip => ip6addr.createCIDR(ip.address));

  addressListCache = {
    ipv4List,
    ipv6List,
    stale: false
  };

  setTimeout(() => {
    addressListCache.stale = true;
  }, 5 * 60 * 1000);

  return {ipv4List, ipv6List};
}

server.listen(process.env.PORT || 8888, (err) => {
  if (err) return console.error(err);
  const port = server.address().port;
  console.log('Server listening on port %s.', port);
});
