const bcrypt = require('bcryptjs');

async function generateHash() {
    const password = 'Admin123456';
    const hash = await bcrypt.hash(password, 10);
    console.log('Contraseña:', password);
    console.log('Hash generado:', hash);
    console.log('\nCopia este hash y úsalo en MySQL:');
    console.log(hash);
}

generateHash();