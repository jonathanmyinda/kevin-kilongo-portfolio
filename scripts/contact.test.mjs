import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { contactEndpoint, contactFields, emptyContact, sendContact, validateContact } from '../src/data/contact.js'

const values = { name: 'Visiteur Test', email: 'visiteur@example.net', phone: '', subject: 'Étude de logement', message: 'Je souhaite discuter de mon projet de logement.', _gotcha: '' }
const endpoint = 'https://formspree.io/f/abcdefgh'
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('champs requis, email, espaces et limites', () => {
  assert.deepEqual(Object.keys(validateContact(emptyContact())), ['name', 'email', 'subject', 'message'])
  assert.deepEqual(validateContact(values), {})
  assert.deepEqual(validateContact({ ...values, name: '  ', email: 'abc', subject: 'x', message: 'court' }), {
    name: 'Ce champ est obligatoire.', email: 'Saisissez une adresse e-mail valide.',
    subject: 'Saisissez au moins 3 caractères.', message: 'Saisissez au moins 10 caractères.',
  })
  for (const field of contactFields) {
    assert(validateContact({ ...values, [field.name]: 'a'.repeat(field.maxLength + 1) })[field.name])
  }
  assert(validateContact({ ...values, email: 'a@example.net\nb@example.net' }).email)
})

test('configuration absente ou incomplète : aucune requête', async () => {
  assert.equal(contactEndpoint('YOUR_FORM_ID', 'true'), null)
  assert.equal(contactEndpoint('abcdefgh', 'false'), null)
  assert.equal(contactEndpoint('abcdefgh', 'true'), endpoint)
  const forbidden = () => assert.fail('Aucune requête autorisée')
  await assert.rejects(sendContact(values, null, forbidden))
  await assert.rejects(sendContact(values, 'https://example.net/f/abcdefgh', forbidden))
  await assert.rejects(sendContact({ ...values, _gotcha: 'bot' }, endpoint, forbidden))
  await assert.rejects(sendContact({ ...values, name: '' }, endpoint, forbidden))
})

test('transport contrôlé : destinataire et expéditeur absents, email pour Reply-To', async () => {
  const before = structuredClone(values)
  let calls = 0
  await sendContact(values, endpoint, async (url, options) => {
    calls++
    assert.equal(url, endpoint)
    assert.equal(options.method, 'POST')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.headers.Accept, 'application/json')
    assert.deepEqual(JSON.parse(options.body), values)
    assert(!('to' in JSON.parse(options.body)))
    assert(!('from' in JSON.parse(options.body)))
    return json(200, { ok: true })
  })
  assert.equal(calls, 1)
  assert.deepEqual(values, before)
})

test('échecs réseau, validation, quota et réponse inattendue : données conservées', async () => {
  const cases = [
    [async () => { throw new TypeError('network') }, /Impossible de confirmer/],
    [async () => { throw new DOMException('timeout', 'AbortError') }, /Impossible de confirmer/],
    [async () => json(422, { errors: [{ message: 'invalid' }] }), /pas été accepté/],
    [async () => json(429, {}), /Patientez/],
    [async () => json(500, {}), /pas été accepté/],
    [async () => new Response('<html>OK</html>'), /Impossible de confirmer/],
    [async () => json(200, {}), /pas été accepté/],
    [async () => json(200, { ok: true, errors: [{ message: 'error' }] }), /pas été accepté/],
  ]
  for (const [fetchImpl, expected] of cases) {
    const input = structuredClone(values)
    await assert.rejects(sendContact(input, endpoint, fetchImpl), expected)
    assert.deepEqual(input, values)
  }
})

test('modèle côté service cohérent avec les contraintes client et destination fixe', async () => {
  const config = JSON.parse(await readFile(new URL('../docs/contact-formspree.example.json', import.meta.url)))
  const form = config.forms.contact
  assert.deepEqual(form.actions, [{ type: 'email', to: 'kevinkilongo7@gmail.com' }])
  for (const field of contactFields) {
    assert.equal(form.fields[field.name].required, field.required)
    assert.equal(form.fields[field.name].maxlength, field.maxLength)
    assert.equal(form.fields[field.name].minlength, field.minLength)
  }
})
