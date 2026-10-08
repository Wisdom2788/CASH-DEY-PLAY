const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'src');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            walk(filepath, callback);
        } else if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
            callback(filepath);
        }
    });
}

const SCREENS = {
    'home': 'routes.home',
    'lobby': 'routes.lobby',
    'game': 'routes.game',
    'result': 'routes.result',
    'tasks': 'routes.tasks',
    'leaderboard': 'routes.leaderboard',
    'profile': 'routes.profile',
    'wallet': 'routes.wallet'
};

walk(directory, (filepath) => {
    let content = fs.readFileSync(filepath, 'utf8');
    let changed = false;

    // Check if file uses setScreen
    if (content.includes('setScreen')) {
        // Add imports if needed
        if (!content.includes('useNavigate')) {
            content = "import { useNavigate } from 'react-router-dom';\nimport routes from '../../config/routes.config';\n" + content;
        }

        // Replace destructuring
        content = content.replace(/const\s*{\s*([^}]*?)setScreen([^}]*?)\s*}\s*=\s*useUIStore\(\);/g, (match, p1, p2) => {
            const inner = (p1 + p2).replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
            if (inner === '') {
                return 'const navigate = useNavigate();';
            }
            return `const { ${inner} } = useUIStore();\n  const navigate = useNavigate();`;
        });

        // Replace setScreen('home') with navigate(routes.home)
        for (const [screen, route] of Object.entries(SCREENS)) {
            const regex1 = new RegExp(`setScreen\\('${screen}'\\)`, 'g');
            const regex2 = new RegExp(`setScreen\\("${screen}"\\)`, 'g');
            content = content.replace(regex1, `navigate(${route})`);
            content = content.replace(regex2, `navigate(${route})`);
        }

        fs.writeFileSync(filepath, content);
        console.log(`Updated ${filepath}`);
    }
});
