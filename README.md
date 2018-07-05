# node-mikrotik-ip-check
Checks if request IP is in mikrotik firewall allowed IP list.

## Installation
1. Enable the Mikrotik API: `/ip service enable api`, default port is 8728.
1. git pull this repo
1. `yarn` or `npm install`
1. Copy the pm2.config.js.example as pm2.config.js
1. Edit pm2.config.js with your mikrotik info.
    * Note: `MIKROTIK_ADDRESS_LIST` is the name of the address list, e.g. `admin`
1. Don't forget to `chmod 600 pm2.config.js` since it contains sensitive information.
1. Run the server with `pm2 start pm2.config.js`

## nginx configuration

### Authorization block

Create a new location block like the following:
```
location /auth-ip {
    internal;
    proxy_pass http://127.0.0.1:8888;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header Host $host;
    proxy_set_header X-Original-URI $request_uri;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Include this block in your server block. You may create a separate file and use the `include` directive.

### Include the authorization block in a reverse proxy

In your reverse proxy location block, you can use something like this:
```
location /<service> {
    satisfy any;
    allow 192.168.0.0/24; # allow LAN IPs
    deny all;
    auth_request /auth-ip; # auth request to node-mikrotik-ip-check server

    proxy_pass http://<service IP>:<service port>;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Real-Port $remote_port;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
