import 'dotenv/config';
import { app } from './app.js';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Auth service listening on http://localhost:${port}`);
});
