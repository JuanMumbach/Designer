const userAgent = process.env.npm_config_user_agent || '';

if (!/yarn\//.test(userAgent)) {
  console.error("This project must use Yarn Classic (1.x). Run: yarn install");
  process.exit(1);
}