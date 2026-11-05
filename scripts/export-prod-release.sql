with active as (
  select r.* from portfolio.site_state s join portfolio.releases r on r.id = s.active_release_id
), selected as (
  select rp.* from portfolio.release_projects rp join active r on r.id = rp.release_id
), site as (
  select s.* from portfolio.site_revisions s join active r on r.site_revision_id = s.id
), snapshot as materialized (
  select $1::jsonb - 'version' as data
), published_ids as (
  select unnest(array[hero_media_id, portrait_media_id, pdf_media_id]) as id from site
  union select x.media_id from portfolio.services x join site s on s.id = x.site_revision_id
  union select x.media_id from portfolio.revision_media x join selected s on s.revision_id = x.revision_id
), files as (
  select m.* from portfolio.media m where m.validated and (
    m.id in (select id from published_ids) or m.id in (
      select d.media_id from portfolio.media_derivatives d join published_ids p on p.id = d.parent_id
      join portfolio.media parent on parent.id = p.id and parent.validated
    ))
)
select jsonb_build_object(
  'snapshot', (select data from snapshot),
  'projects', (select jsonb_agg(to_jsonb(p) order by p.id) from portfolio.projects p join selected s on s.project_id = p.id),
  'project_revisions', (select jsonb_agg((to_jsonb(r) - 'internal') || jsonb_build_object('internal',
    jsonb_build_object('number', p.data->'number', 'year', p.data->'year', 'phase', p.data->'phase',
      'tools', p.data->'tools', 'typologies', p.data->'typologies',
      'missionLabel', p.data->'missionLabel', 'publicRole', r.mission)) order by r.id)
    from portfolio.project_revisions r join selected s on s.revision_id = r.id
    cross join snapshot snap
    join lateral jsonb_array_elements(snap.data->'projects') p(data) on p.data->>'revisionId' = r.id::text),
  'revision_media', (select jsonb_agg(to_jsonb(m) order by m.revision_id, m.position)
    from portfolio.revision_media m join selected s on s.revision_id = m.revision_id),
  'site_revisions', (select jsonb_agg((to_jsonb(s) - 'internal') || jsonb_build_object('internal',
    jsonb_build_object('profile', jsonb_build_object(
      'education', snap.data->'profile'->'education', 'experiences', snap.data->'profile'->'experiences',
      'internships', snap.data->'profile'->'internships', 'software', snap.data->'profile'->'software',
      'languages', snap.data->'profile'->'languages',
      'portfolio', jsonb_build_object('sha256', m.sha256, 'pages', snap.data->'profile'->'pdf'->'pages')))))
    from site s join portfolio.media m on m.id = s.pdf_media_id cross join snapshot snap),
  'services', (select jsonb_agg(to_jsonb(x) order by x.position) from portfolio.services x join site s on s.id = x.site_revision_id),
  'social_links', (select coalesce(jsonb_agg(to_jsonb(x) order by x.position), '[]') from portfolio.social_links x join site s on s.id = x.site_revision_id),
  'media', (select jsonb_agg(to_jsonb(m) order by m.id) from files m),
  'media_derivatives', (select coalesce(jsonb_agg(to_jsonb(d) order by d.parent_id,d.media_id), '[]')
    from portfolio.media_derivatives d join files p on p.id = d.parent_id join files m on m.id = d.media_id),
  'releases', (select jsonb_agg(to_jsonb(r) || '{"created_by":null}'::jsonb) from active r),
  'release_projects', (select jsonb_agg(to_jsonb(s) order by s.project_id) from selected s)
) as release;
