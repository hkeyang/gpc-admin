import { readFile } from 'node:fs/promises';
import { Resolver } from 'node:dns/promises';

const productionDomain = 'wuhk.top';
const wranglerConfig = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

if (/"custom_domain"\s*:\s*true/.test(wranglerConfig)) {
  throw new Error('发布已阻止：wrangler.jsonc 不得管理 Custom Domain，避免部署时改写生产 DNS。');
}

const resolver = new Resolver();
resolver.setServers(['1.1.1.1', '8.8.8.8']);

const results = await Promise.allSettled([
  resolver.resolve4(productionDomain),
  resolver.resolve6(productionDomain)
]);
const addresses = results
  .filter((result) => result.status === 'fulfilled')
  .flatMap((result) => result.value);

if (addresses.length === 0) {
  throw new Error(`发布已阻止：${productionDomain} 当前没有公网 A/AAAA 记录。`);
}

console.log(`生产域名检查通过：${productionDomain} -> ${addresses.join(', ')}`);
