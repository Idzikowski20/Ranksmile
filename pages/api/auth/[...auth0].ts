import { handleAuth, handleLogout } from '@auth0/nextjs-auth0';

export default handleAuth({
   // Po wylogowaniu wróć na stronę logowania
   logout: handleLogout({
      returnTo: process.env.AUTH0_BASE_URL ? `${process.env.AUTH0_BASE_URL}/login` : '/login',
   }),
});
