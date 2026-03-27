const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project root
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in project root
config.watchFolders = [projectRoot];

// 2. Let Metro know where to resolve node_modules
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
];

// 3. Force resolve specific problematic modules
config.resolver.extraNodeModules = {
    'expo-device': path.resolve(projectRoot, 'node_modules/expo-device'),
};

module.exports = config;
