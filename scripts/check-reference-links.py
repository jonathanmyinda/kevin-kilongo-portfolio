from pathlib import Path
import importlib.util,json
spec=importlib.util.spec_from_file_location('a',Path('scripts/audit-reference-site.py'));a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
urls=['https://www.linkedin.com/in/kevin-kilongo-778a543a0','https://www.instagram.com/kilongokevin/','https://wa.me/message/6SE5RNJA3PEJM1']
out=[]
for url in urls:
 try:
  data,status,final,headers=a.fetch(url)
  out.append({'sourceUrl':url,'status':status,'resolvedUrl':final,'bytes':len(data),'note':'Lecture GET seulement ; identité du titulaire non certifiée.'})
 except Exception as e:out.append({'sourceUrl':url,'error':str(e),'resolvedUrl':None})
a.save_json(a.OUT/'social-link-checks.json',out)
print(json.dumps(out,ensure_ascii=True))
