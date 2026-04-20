const { spawn } = require('child_process');
const os = require('os');

function getPrimaryIp() {
    const interfaces = os.networkInterfaces();
    
    // Prioritize Wi-Fi and Ethernet over Virtual/Docker adapters
    for (const name of Object.keys(interfaces)) {
        if (name.toLowerCase().includes('vbox') || 
            name.toLowerCase().includes('wsl') || 
            name.toLowerCase().includes('virtual') || 
            name.toLowerCase().includes('vethernet')) {
            continue;
        }

        for (const iface of interfaces[name]) {
            // We want a valid external IPv4 address
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1'; // fallback
}

const ip = getPrimaryIp();
console.log('\x1b[36m%s\x1b[0m', `🚀 Auto-detected preferred LAN IP: ${ip}`);

// Set the environment variable for Expo
process.env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;

// Spawn expo start
const expo = spawn('npx', ['expo', 'start', '--dev-client', '--lan'], {
    stdio: 'inherit',
    shell: true,
    env: process.env
});

expo.on('close', (code) => {
    process.exit(code);
});
