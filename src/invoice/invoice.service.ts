import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  private readonly storagePath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.storagePath = path.join(
      process.cwd(),
      config.get('LOCAL_STORAGE_PATH', 'storage/media'),
      'invoices',
    );
  }

  // ── Generate and persist invoice ───────────────────────────────
  async generateAndStore(orderId: string): Promise<string | null> {
    try {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId },
        include: {
          products: true,
          taxes: true,
          transaction: { select: { transactionId: true, paidAt: true } },
        },
      });

      if (!order) return null;

      await fs.mkdir(this.storagePath, { recursive: true });

      // Generate PDF using PDFKit (requires: npm install pdfkit @types/pdfkit)
      const pdfPath = path.join(
        this.storagePath,
        `invoice-${order.orderNumber}.pdf`,
      );
      await this.writePdf(order, pdfPath);

      this.logger.log(`Invoice generated: invoice-${order.orderNumber}.pdf`);
      return pdfPath;
    } catch (err) {
      this.logger.error('Invoice generation failed', err);
      return null;
    }
  }

  // ── Get invoice path for download ──────────────────────────────
  async getInvoicePath(orderId: string): Promise<string | null> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      select: { orderNumber: true },
    });
    if (!order) return null;

    const pdfPath = path.join(
      this.storagePath,
      `invoice-${order.orderNumber}.pdf`,
    );
    try {
      await fs.access(pdfPath);
      return pdfPath;
    } catch {
      return null;
    }
  }

  // ── PDF Generation ─────────────────────────────────────────────
  private async writePdf(order: any, outputPath: string): Promise<void> {
    // Dynamic import to avoid crashing if pdfkit is not installed
    let PDFDocument: any;
    try {
      PDFDocument = (await import('pdfkit')).default;
    } catch {
      this.logger.warn(
        'pdfkit not installed — run: npm install pdfkit @types/pdfkit',
      );
      // Fallback: write a plain text "invoice"
      const text = this.buildTextInvoice(order);
      await fs.writeFile(outputPath.replace('.pdf', '.txt'), text, 'utf-8');
      return;
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        try {
          await fs.writeFile(outputPath, Buffer.concat(chunks));
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      doc.on('error', reject);

      // ── Header ────────────────────────────────────────────────
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('INVOICE', { align: 'center' });
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Invoice #${order.orderNumber}`, { align: 'center' })
        .text(
          `Date: ${new Date(order.createdAt).toLocaleDateString('en-BD')}`,
          { align: 'center' },
        );

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // ── Billing Info ──────────────────────────────────────────
      doc.font('Helvetica-Bold').text('Billed To:');
      doc
        .font('Helvetica')
        .text(`${order.customerFirstName} ${order.customerLastName}`)
        .text(`Phone: ${order.customerPhone}`)
        .text(`Email: ${order.customerEmail || '—'}`);

      const addr = order.shippingAddress;
      if (addr?.addressLine) {
        doc.text(
          `${addr.addressLine}, ${addr.area || ''}, ${addr.city || ''}, ${addr.division || ''} ${addr.postalCode || ''}`,
        );
      }

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // ── Items Table ───────────────────────────────────────────
      doc.font('Helvetica-Bold').text('Items', { underline: true });
      doc.moveDown(0.5);

      const colX = { item: 50, qty: 310, price: 380, total: 470 };

      doc.font('Helvetica-Bold');
      doc.text('Product', colX.item, doc.y, { width: 250, continued: true });
      doc.text('Qty', colX.qty, doc.y, { width: 60, continued: true });
      doc.text('Price', colX.price, doc.y, { width: 80, continued: true });
      doc.text('Total', colX.total, doc.y, { width: 75 });
      doc.moveDown(0.3);

      doc.font('Helvetica');
      for (const item of order.products) {
        const y = doc.y;
        doc.text(item.productName, colX.item, y, {
          width: 250,
          continued: true,
        });
        doc.text(String(item.qty), colX.qty, y, { width: 60, continued: true });
        doc.text(
          `৳${parseFloat(item.unitPrice.toString()).toFixed(2)}`,
          colX.price,
          y,
          { width: 80, continued: true },
        );
        doc.text(
          `৳${parseFloat(item.lineTotal.toString()).toFixed(2)}`,
          colX.total,
          y,
          { width: 75 },
        );
        doc.moveDown(0.3);
      }

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // ── Totals ────────────────────────────────────────────────
      const right = 470;
      const rightWidth = 75;

      doc.font('Helvetica');
      doc.text('Subtotal:', right - 90, doc.y, { width: 90, continued: true });
      doc.text(
        `৳${parseFloat(order.subTotal.toString()).toFixed(2)}`,
        right,
        doc.y,
        { width: rightWidth },
      );

      if (parseFloat(order.shippingCost.toString()) > 0) {
        doc.text('Shipping:', right - 90, doc.y, {
          width: 90,
          continued: true,
        });
        doc.text(
          `৳${parseFloat(order.shippingCost.toString()).toFixed(2)}`,
          right,
          doc.y,
          { width: rightWidth },
        );
      }

      if (parseFloat(order.discount.toString()) > 0) {
        doc.text('Discount:', right - 90, doc.y, {
          width: 90,
          continued: true,
        });
        doc.text(
          `-৳${parseFloat(order.discount.toString()).toFixed(2)}`,
          right,
          doc.y,
          { width: rightWidth },
        );
      }

      doc.font('Helvetica-Bold');
      doc.text('Total:', right - 90, doc.y, { width: 90, continued: true });
      doc.text(
        `৳${parseFloat(order.total.toString()).toFixed(2)}`,
        right,
        doc.y,
        { width: rightWidth },
      );

      doc.moveDown();
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`Payment: ${order.paymentMethod}  |  Status: ${order.status}`, {
          align: 'center',
        })
        .text('Thank you for your order!', { align: 'center' });

      doc.end();
    });
  }

  private buildTextInvoice(order: any): string {
    const lines = [
      `INVOICE #${order.orderNumber}`,
      `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
      '='.repeat(40),
      `Customer: ${order.customerFirstName} ${order.customerLastName}`,
      `Phone: ${order.customerPhone}`,
      '-'.repeat(40),
      'Items:',
      ...order.products.map(
        (p: any) => `  ${p.productName} x${p.qty} — ৳${p.lineTotal}`,
      ),
      '-'.repeat(40),
      `Subtotal:  ৳${order.subTotal}`,
      `Shipping:  ৳${order.shippingCost}`,
      `Discount: -৳${order.discount}`,
      `Total:     ৳${order.total}`,
      '='.repeat(40),
      `Payment: ${order.paymentMethod}`,
    ];
    return lines.join('\n');
  }
}
