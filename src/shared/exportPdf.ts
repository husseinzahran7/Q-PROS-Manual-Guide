import { jsPDF } from "jspdf";
import type { SessionBundle, RecordedAction, ScreenshotRecord } from "./types";

function byActionId(screenshots: ScreenshotRecord[]) {
  return new Map(screenshots.map((s) => [s.actionId, s]));
}

function actionDescription(action: RecordedAction): string {
  if (action.type === "note") return action.title || "Manual step";
  if (action.type === "wait") return action.title || `Wait ${action.value || "2"}s`;
  if (action.type === "click") {
    return `Click on "${action.target.ariaLabel || action.target.text || action.target.selector}"`;
  }
  if (action.type === "input") {
    const base = `Type in "${action.target.ariaLabel || action.target.placeholder || action.target.selector}"`;
    return action.value && action.valuePolicy !== "runtime" ? `${base}: ${action.value}` : base;
  }
  if (action.type === "keydown") return `Press key "${action.key}"`;
  if (action.type === "navigation") return `Navigate to ${action.page.url}`;
  if (action.type === "change") {
    const base = `Change value in "${action.target.ariaLabel || action.target.selector}"`;
    return action.value ? `${base}: ${action.value}` : base;
  }
  if (action.type === "submit") return "Submit form";
  return `${action.type}`;
}

export async function generatePdf(bundle: SessionBundle): Promise<Blob> {
  const screenshotMap = byActionId(bundle.screenshots);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Title page — vertically centered
  const centerY = pageHeight / 2 - 50;

  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 46);
  doc.text("Q-PROS Manual Guide", pageWidth / 2, centerY, { align: "center" });

  doc.setFontSize(20);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(22, 33, 62);
  doc.text(bundle.session.title, pageWidth / 2, centerY + 35, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(102, 102, 102);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, centerY + 65, { align: "center" });
  doc.text(`URL: ${bundle.session.startUrl || "N/A"}`, pageWidth / 2, centerY + 82, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(170, 170, 170);
  doc.text("Created by Hussein Zahran", pageWidth / 2, centerY + 100, { align: "center" });

  // Separator line
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(224, 90, 85);
  doc.setLineWidth(2);
  doc.line(margin, centerY + 115, pageWidth - margin, centerY + 115);

  // Start steps on a new page
  doc.addPage();
  yPosition = margin;

  // Steps
  bundle.actions.forEach((action, index) => {
    const step = index + 1;
    const screenshot = screenshotMap.get(action.id);

    // Check if we need a new page (need at least 200pt for screenshot)
    if (yPosition > pageHeight - 250) {
      doc.addPage();
      yPosition = margin;
    }

    // Step number + title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(224, 90, 85);
    doc.text(`Step ${step}: ${action.title}`, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 22;

    // Action description
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    const desc = actionDescription(action);
    const descLines = doc.splitTextToSize(desc, contentWidth);
    descLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 14;
    });
    yPosition += 8;

    // URL and time
    doc.setFontSize(9);
    doc.setTextColor(102, 102, 102);
    doc.text(`URL: ${action.page.url}`, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 12;
    doc.text(`Time: ${new Date(action.createdAt).toLocaleString()}`, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 16;

    // Screenshot
    if (screenshot) {
      try {
        const imgWidth = Math.min(contentWidth, 500);
        const imgHeight = imgWidth * 0.6; // Approximate aspect ratio

        // Check if screenshot fits on current page
        if (yPosition + imgHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }

        const imgX = (pageWidth - imgWidth) / 2;
        doc.addImage(screenshot.dataUrl, "JPEG", imgX, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 20;
      } catch {
        doc.setFontSize(10);
        doc.setTextColor(153, 153, 153);
        doc.text("[Screenshot could not be embedded]", pageWidth / 2, yPosition, { align: "center" });
        yPosition += 20;
      }
    }

    // Separator between steps
    if (index < bundle.actions.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 20;
    }
  });

  // Return blob instead of saving directly (Chrome extension compatibility)
  // Use arraybuffer for better Chrome extension compatibility
  const arrayBuffer = doc.output("arraybuffer");
  return new Blob([arrayBuffer], { type: "application/pdf" });
}
