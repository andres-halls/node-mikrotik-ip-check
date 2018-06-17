const http = require('http');
const MikroNode = require('mikronode-ng');

const host = process.env.MIKROTIK_ADDRESS;
if (!host) return console.error('MIKROTIK_ADDRESS missing from env!');
const username = process.env.MIKROTIK_USERNAME;
if (!username) return console.error('MIKROTIK_USERNAME missing from env!');
const password = process.env.MIKROTIK_PASSWORD;
if (!password) return console.error('MIKROTIK_PASSWORD missing from env!');
const listName = process.env.MIKROTIK_ADDRESS_LIST;
if (!listName) return console.error('MIKROTIK_ADDRESS_LIST missing from env!');

const server = http.createServer(async function (req, res) {
    try {
        const requestIP = req.headers['x-real-ip'] || req.connection.remoteAddress;
        const connection = MikroNode.getConnection(host, username, password, {closeOnDone: true});
        const conn = await connection.getConnectPromise();
        const addressList = await conn.getCommandPromise('/ip/firewall/address-list/print');

        if (addressList.find(ip => ip.address === requestIP && ip.disabled === 'false' && ip.list === listName)) {
            console.log('IP %s allowed', requestIP);
            res.statusCode = 200;
            return res.end();
        }

        console.log('IP %s not allowed', requestIP);
        res.statusCode = 403;
        res.end();
    } catch (err) {
        console.error(err);
        res.statusCode(500).end();
    }
});

server.listen(process.env.PORT || 8888, (err) => {
    if (err) return console.error(err);
    const port = server.address().port;
    console.log('Server listening on port %s.', port);
});