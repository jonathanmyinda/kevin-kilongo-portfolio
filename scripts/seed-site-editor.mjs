// Idempotent initial editor draft, copied from current sources. Never publishes.
import { readFileSync } from 'node:fs'
import { verifyTarget, sql, quote } from './dev-tools.mjs'
verifyTarget()
const media = JSON.parse(readFileSync('src/data/published-media.json', 'utf8'))
const profile = JSON.parse(readFileSync('src/data/profile.json', 'utf8'))
const home = readFileSync('src/sections/HomeSections.jsx', 'utf8')
const subtitle = home.match(/className="hero-description">([^<]+)</)?.[1]
const approach = home.match(/className="lead">([^<]+)</)?.[1]
const presentation = home.match(/className="about-facts">([^<]+)</)?.[1]
if (!subtitle || !approach || !presentation) throw Error('Textes actuels non extraits : aucun remplissage inventé')
const current = sql('select revision_id from portfolio.site_workspace')[0]
if (current.revision_id) { console.log('Brouillon de profil déjà présent, aucune modification.'); process.exit(0) }
const source = sql('select portfolio.working_site() id')[0].id
const files = sql(`select id,legacy_path from portfolio.media where validated and legacy_path in(${quote(media.heroPortrait.src)},${quote(media.portrait.src)});`)
const hero = files.find(f => f.legacy_path === media.heroPortrait.src), portrait = files.find(f => f.legacy_path === media.portrait.src)
if (!hero || !portrait) throw Error('Derniers portraits validés introuvables dans DEV')
sql(`begin;
update portfolio.media set pages=${Number(profile.portfolio.pages)} where sha256=${quote(profile.portfolio.sha256)} and kind='pdf' and pages is null;
do $$ declare rid uuid:=gen_random_uuid(); begin
 perform 1 from portfolio.site_workspace for update;
 if (select revision_id from portfolio.site_workspace) is not null then raise exception 'Brouillon déjà créé : arrêt'; end if;
 insert into portfolio.site_revisions(id,name,profession,location,presentation,signature_home,signature_about,email,phone,whatsapp,hero_media_id,portrait_media_id,pdf_media_id,internal,home_subtitle,approach,hero_alt,hero_credit,portrait_alt,portrait_credit,pdf_download_name)
 select rid,name,profession,location,${quote(presentation)},signature_home,signature_about,email,phone,whatsapp,${quote(hero.id)},${quote(portrait.id)},pdf_media_id,internal,${quote(subtitle)},${quote(approach)},${quote(media.heroPortrait.alt)},${media.heroPortrait.credit ? quote(media.heroPortrait.credit) : 'null'},${quote(media.portrait.alt)},${media.portrait.credit ? quote(media.portrait.credit) : 'null'},'portfolio-kevin-kilongo-munganga.pdf' from portfolio.site_revisions where id=${quote(source)};
 insert into portfolio.services select rid,position,title,description,media_id,alt,credit from portfolio.services where site_revision_id=${quote(source)};
 insert into portfolio.social_links select rid,position,label,url from portfolio.social_links where site_revision_id=${quote(source)};
 update portfolio.site_workspace set revision_id=rid,baseline_revision_id=rid where singleton;
end $$;
commit;`)
console.log('Brouillon prérempli : textes actuels, deux derniers portraits, services et PDF existant. Aucune publication.')
