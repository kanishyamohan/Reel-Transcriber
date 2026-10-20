# Invoice Maker

A single-page invoice generator. You type the **customer name** and the
**price** (plus a short item description); everything else fills itself:

- **Invoice date**: today
- **Payment due**: 1 month after the invoice date (changeable in *Your details*)
- **Invoice ID**: `INV-YYYYMMDD`, with `-2`, `-3`… if you make more than one a day
- **Your details**: name, title, photo, contact, address, bank, IFSC and PAN
- **Customer address and GST number**: remembered after the first invoice for that customer
- **Item names**: suggested from past invoices

Pages: **Domestic** and **International** (form + live preview, Save as
Draft, Download PDF),
**Invoices** (search, filter by status and type, change status inline,
edit, duplicate, download, delete, and bulk mark paid / sent / delete, with
Waiting / Overdue / Paid totals), **Customers** (edit or delete saved customers) and **Your details**.
Discount, GST % and notes to the customer are optional.

**Paste a client's message:** open *Paste client's message* at the top of
the form, paste their email or WhatsApp reply, and click *Fill in details*.
It fills the customer name, billing address, country, VAT / EIN / GST number,
currency, payment terms and PO number (into the notes), plus any priced items
if the form is still empty, and switches between Domestic and International
to match the country. Inside claude.ai it asks Claude to read the message;
elsewhere it uses a built-in reader that handles labelled details
("Company name:", "Address:", "VAT number:") and common formats. Always check
the filled fields before sending.

**Payment accounts:** under *Your details → Payment Accounts* add as many
accounts as you like: Indian bank (with optional SWIFT code and branch
address for payments from abroad), USD (ACH / wire routing), GBP (sort code /
IBAN), EUR (IBAN), UPI, or PayPal / other. Give each one a name and choose
when it is picked automatically (domestic invoices, international invoices,
or invoices in a given currency). On every invoice, *Payment Account* lets
you switch to another account and *Also show* adds a second way to pay.
Each saved invoice remembers the accounts it used.

**Currencies:** every invoice has a currency switch (INR, USD, GBP, EUR, CAD,
AUD, SGD, AED, JPY).

**International invoices** (UK, US and other countries):
- pick the client's country, and the currency follows (US → USD, UK → GBP…)
- the client's VAT number / EIN / tax ID replaces the GST number
- no GST rows; add a tax % only if you need one
- the payment block shows the account picked for that invoice (see below)
- an optional exchange rate shows the rupee value in your invoice list

The PDF follows the layout of the original Canva invoice: big "Invoice"
heading, billed-to block, Description / Rate / Qty / Amount table with GST
rows, and payment information. It is saved as
`Invoice - <Client> <Item> - <Your name>.pdf`.

## Use it

Online: **https://kanishyamohan.github.io/Reel-Transcriber/** (GitHub Pages,
once it is turned on; see *Hosting* below). Or open `index.html` in a browser. Nothing needs installing; the page loads two
small libraries (html2canvas and jsPDF) and its fonts from public CDNs.

1. The first time, the page opens on **Your details**. Fill them in once;
   they are saved in this browser.
2. Type the customer's name. A saved customer fills in by itself. A new
   customer asks for an address and GST number once.
3. Type what you did and the price. Turn on **Add GST** if you need it.
4. Click **Download PDF** (or **Save as Draft**). The invoice is listed under
   **Invoices**, where you can reopen it or mark it paid.

Your details, customers and past invoices are kept in the browser's
`localStorage`. Nothing personal is stored in this repository.

## Hosting (GitHub Pages)

The repo root has an `index.html` that forwards to `invoice-maker/`, and a
`.nojekyll` file so GitHub serves the files exactly as they are.

To turn it on: **Settings → Pages → Build and deployment → Source: Deploy from
a branch**, pick the branch that holds this folder and `/ (root)`, then
**Save**. After a minute or two the site is live at
`https://<user>.github.io/<repo>/`.

Anyone with the link can use the page, but everything they type stays in
their own browser. Your details are never on the site itself.
