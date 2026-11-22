import { db, enqueueWrite, logChange } from '../db.js';

const fields = [
  'name',
  'street',
  'postcode',
  'city',
  'ust_idnr',
  'tax_number',
  'bank_name',
  'iban',
  'bic',
];

const emptyCompany = () => ({
  id: 1,
  name: null,
  street: null,
  postcode: null,
  city: null,
  ust_idnr: null,
  tax_number: null,
  bank_name: null,
  iban: null,
  bic: null,
});

function normalize(body) {
  const out = {};
  for (const f of fields) {
    out[f] = body[f] == null || body[f] === '' ? null : String(body[f]).trim();
  }
  return out;
}

export default async function companyRoutes(app) {
  app.get('/', async () => {
    const row = db.prepare('SELECT * FROM company_info WHERE id = 1').get();
    return row ?? emptyCompany();
  });

  app.put('/', async (req) => {
    const data = normalize(req.body ?? {});

    return enqueueWrite(() => {
      const old = db.prepare('SELECT * FROM company_info WHERE id = 1').get() ?? null;

      db.prepare(`
        INSERT INTO company_info
          (id, name, street, postcode, city, ust_idnr, tax_number, bank_name, iban, bic)
        VALUES
          (1, @name, @street, @postcode, @city, @ust_idnr, @tax_number, @bank_name, @iban, @bic)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          street = excluded.street,
          postcode = excluded.postcode,
          city = excluded.city,
          ust_idnr = excluded.ust_idnr,
          tax_number = excluded.tax_number,
          bank_name = excluded.bank_name,
          iban = excluded.iban,
          bic = excluded.bic
      `).run(data);

      const updated = db.prepare('SELECT * FROM company_info WHERE id = 1').get();
      logChange('company_info', 1, old ? 'update' : 'create', old, updated);
      return updated;
    });
  });
}