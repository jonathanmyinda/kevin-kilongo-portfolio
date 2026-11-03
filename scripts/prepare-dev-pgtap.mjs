import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
const ref='pahbwurduwagdglpslos'
let sql=await readFile('supabase/tests/admin_access.test.sql','utf8')
for(const id of new Set(sql.match(/[1-6]0000000-0000-0000-0000-00000000000[12]/g)))sql=sql.replaceAll(id,randomUUID())
const run=randomUUID()
sql=sql.replaceAll('fixture/',`test-${run}/`).replaceAll("'fixture'",`'test-${run}'`).replaceAll('admin-fixture@example.invalid',`admin-${run}@example.invalid`).replaceAll('user-fixture@example.invalid',`user-${run}@example.invalid`)
sql=sql.replace('begin;','begin;\ncreate temporary table admin_test_results(result text);\ngrant insert on admin_test_results to anon,authenticated;')
sql=sql.replace(/^select (plan\(|is\(|throws_like\(|lives_ok\(|ok\(|\* from finish\()/gm,'insert into admin_test_results(result) select $1')
sql=sql.replace('rollback;',`reset role;
do $report$ declare data text; begin
 select replace(encode(convert_to(json_agg(left(split_part(split_part(result,E'\\n',1),' - ',1),80))::text,'UTF8'),'base64'),E'\\n','') into data from admin_test_results;
 raise exception using message='PORTFOLIO_TAP_REPORT_BASE64:'||data;
end $report$;
rollback;`)
await mkdir('node_modules/.cache/admin-dev-tests',{recursive:true})
await writeFile('node_modules/.cache/admin-dev-tests/pgtap.sql',sql)
console.log(`pgTAP préparé pour ${ref}; UUID uniques; rapport par exception intentionnelle, transaction intégralement annulée.`)
