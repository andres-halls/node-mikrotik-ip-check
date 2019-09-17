const http = require('http');
const MikroNode = require('mikronode-ng');
const chalk = require('chalk');

const host = process.env.MIKROTIK_ADDRESS;
const port = process.env.MIKROTIK_API_PORT || 8728;
if (!host) return console.error('MIKROTIK_ADDRESS missing from env!');
const username = process.env.MIKROTIK_USERNAME;
if (!username) return console.error('MIKROTIK_USERNAME missing from env!');
const password = process.env.MIKROTIK_PASSWORD;
if (!password) return console.error('MIKROTIK_PASSWORD missing from env!');
const listName = process.env.MIKROTIK_ADDRESS_LIST;
if (!listName) return console.error('MIKROTIK_ADDRESS_LIST missing from env!');
let trusted_ips = [];
if (process.env.TRUSTED_IPS) trusted_ips = process.env.TRUSTED_IPS.split(' ');

const server = http.createServer(async function (req, res) {
    try {
        const requestURL = req.headers['host'] + req.headers['x-original-uri'];
        const requestIP = req.headers['x-real-ip'] || req.connection.remoteAddress;
        const connection = MikroNode.getConnection(host, username, password, {port, closeOnDone: true});
        const conn = await connection.getConnectPromise();
        const addressList = await conn.getCommandPromise('/ip/firewall/address-list/print');

        if (addressList.find(ip => ip.address === requestIP && ip.disabled === 'false' && ip.list === listName)) {
            if (!trusted_ips.find(ip => ip === requestIP)) {
                console.log(chalk`{yellow [!]} IP {bold ${requestIP}} allowed, but not in TRUSTED_IPS.`);
                console.log(`\tRequested URL: ${requestURL}`);
            }
            res.statusCode = 200;
            return res.end();
        }

        console.log(chalk`{red [!]} IP {bold ${requestIP}} not allowed.`);
        console.log(`\tRequested URL: ${requestURL}`);
        res.statusCode = 403;
        res.end();
    } catch (err) {
        console.error(err);
        res.statusCode = 500;
        res.end();
    }
});

server.listen(process.env.PORT || 8888, (err) => {
    if (err) return console.error(err);
    const port = server.address().port;
    console.log('Server listening on port %s.', port);
});
