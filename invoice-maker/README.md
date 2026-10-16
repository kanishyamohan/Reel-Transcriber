# Invoice Maker

A single-page invoice generator. You type the **customer name** and the
**price** (plus a short item description); everything else fills itself:

- **Invoice date**: today
- **Payment due**: 1 month after the invoice date (changeable in *Your details*)
- **Invoice ID**: `INV-YYYYMMDD`, with `-2`, `-3`… if you make more than one a day
- **Your details**: name, title, photo, contact, address, bank, IFSC and PAN
- **Customer address and GST number**: remembered after the first invoice for that customer
- **Item names**: suggested from past invoices

The PDF follows the layout of the original Canva invoice: big "Invoice"
heading, billed-to block, Description / Rate / Qty / Amount table with GST
rows, and payment information. It is saved as
`Invoice - <Client> <Item> - <Your name>.pdf`.

## Use it

Online: **https://kanishyamohan.github.io/Reel-Transcriber/** (GitHub Pages,
once it is turned on; see *Hosting* below). Or open `index.html` in a browser. Nothing needs installing; the page loads two
small libraries (html2canvas and jsPDF) and its fonts from public CDNs.

1. The first time, click the person icon (top right of the form) and fill in
   **Your details**. They are saved in this browser.
2. Type the customer's name. A saved customer fills in by itself. A new
   customer asks for an address and GST number once.
3. Type what you did and the price. Turn on **Add GST** if you need it.
4. Click **Download PDF**. The invoice is added to **Recent invoices**, so you
   can open it again and download it again later.

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
