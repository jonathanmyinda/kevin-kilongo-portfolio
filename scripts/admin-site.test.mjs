import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { validateSite,contactURLs } from '../server/admin/site.mjs'
import { validatePDF,PDF_LIMIT } from '../server/admin/pdf-validation.mjs'
const id='11111111-1111-4111-8111-111111111111'
const profile={name:'Test',profession:'Architecte',location:'Test',headline:'Architecture de sens, héritage en mouvement',subtitle:'Sous-titre',presentation:'Présentation',approach:'Démarche',signatureAbout:'Patrimoine & modernité : une même architecture',email:'fixture+dev@example.invalid',phone:'+243 813 732 058',heroMediaId:id,heroAlt:'Portrait de test',heroCredit:null,portraitMediaId:id,portraitAlt:'Autre portrait de test',portraitCredit:null,pdfMediaId:id,pdfDownloadName:'portfolio-test.pdf',services:[],socials:[{label:'Test',url:'https://example.invalid/@test'}]}
test('contrat profil et construction des contacts sans action automatique',()=>{
 const data=validateSite(profile),links=contactURLs(data.email,data.phone)
 assert.equal(links.whatsapp,'https://wa.me/243813732058');assert.equal(decodeURIComponent(links.email),'mailto:fixture+dev@example.invalid')
 assert.equal(data.socials[0].url,'https://example.invalid/@test')
 for(const url of ['javascript:alert(1)','http://example.invalid','https://name:password@example.invalid'])assert.throws(()=>validateSite({...profile,socials:[{label:'Test',url}]}))
 assert.throws(()=>validateSite({...profile,email:'a@example.invalid\r\nBcc:test@example.invalid'}))
 assert.throws(()=>validateSite({...profile,phone:'javascript:123'}));assert.throws(()=>validateSite({...profile,pdfDownloadName:'../../test.pdf'}))
 assert.throws(()=>validateSite({...profile,internal:{}}));assert.throws(()=>validateSite({...profile,services:[{title:'Service',description:'Texte',mediaId:id,alt:'',credit:null}]}))
})
test('PDF réel avec pages et dessin interprétés par les deux parseurs',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Document fictif de validation')
 const bytes=Buffer.from(await pdf.save()),result=await validatePDF(bytes,bytes.length)
 assert.equal(result.pages,1);assert.equal(result.bytes,bytes.length);assert.match(result.sha,/^[a-f0-9]{64}$/)
})
test('faux PDF, structure tronquée, script actif et poids excessif refusés',async()=>{
 const fake=Buffer.from('%PDF-1.7\nceci ne contient pas de structure PDF\n%%EOF\n')
 await assert.rejects(validatePDF(fake,fake.length),{status:422})
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save())
 await assert.rejects(validatePDF(bytes.subarray(0,100),100),{status:422})
 pdf.addJavaScript('interdit','app.alert("test")');const active=Buffer.from(await pdf.save())
 await assert.rejects(validatePDF(active,active.length),{status:422})
 await assert.rejects(validatePDF(Buffer.alloc(PDF_LIMIT+1),PDF_LIMIT+1),{status:413})
})
