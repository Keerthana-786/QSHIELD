"""Q-SHIELD — Security Report Generation (PDF)"""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from io import BytesIO
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, ThreatEvent

router = APIRouter()


@router.get("/security-report")
async def generate_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate downloadable PDF security report for the user"""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
    except ImportError:
        return {"error": "ReportLab not installed"}

    # Fetch recent events
    result = await db.execute(
        select(ThreatEvent)
        .where(ThreatEvent.user_id == current_user.id)
        .order_by(desc(ThreatEvent.created_at))
        .limit(20)
    )
    events = result.scalars().all()

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    story = []

    # Title
    title_style = ParagraphStyle(
        "title", parent=styles["Title"],
        textColor=colors.HexColor("#0066ff"),
        fontSize=20, spaceAfter=6
    )
    story.append(Paragraph("Q-SHIELD — Personal Security Report", title_style))
    story.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]))
    story.append(Spacer(1, 10*mm))

    # Summary
    story.append(Paragraph(f"Student: {current_user.full_name}", styles["Heading2"]))
    story.append(Paragraph(f"Digital Safety Score: {current_user.digital_safety_score:.0f}/100", styles["Normal"]))
    story.append(Paragraph(f"Total Scans: {len(events)}", styles["Normal"]))
    story.append(Spacer(1, 8*mm))

    # Threat table
    if events:
        story.append(Paragraph("Recent Threat Events", styles["Heading2"]))
        table_data = [["Date", "Type", "Severity", "Score", "Action"]]
        for e in events[:15]:
            table_data.append([
                e.created_at.strftime("%m/%d %H:%M") if e.created_at else "N/A",
                e.event_type.replace("_", " ").title(),
                e.severity,
                f"{e.risk_score:.0f}",
                e.recommended_action[:40] + "..." if e.recommended_action and len(e.recommended_action) > 40 else (e.recommended_action or ""),
            ])

        t = Table(table_data, colWidths=[30*mm, 35*mm, 25*mm, 20*mm, 55*mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0066ff")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4ff")]),
        ]))
        story.append(t)

    doc.build(story)
    pdf_bytes = buf.getvalue()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=qshield_report_{current_user.username}.pdf"},
    )
