const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'src', 'features');

function walk(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            walk(filepath, callback);
        } else if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
            callback(filepath);
        }
    });
}

walk(viewsDir, (filepath) => {
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Replace export const ComponentName: React.FC = () => {
    // with export default function ComponentName() {
    const regex = /export\s+const\s+([A-Za-z0-9_]+)\s*:\s*React\.FC\s*(?:<\s*any\s*>)?\s*=\s*\([^)]*\)\s*=>\s*\{/g;
    
    if (regex.test(content)) {
        content = content.replace(regex, 'export default function $1() {');
        fs.writeFileSync(filepath, content);
        console.log(`Updated ${filepath}`);
    }
});
