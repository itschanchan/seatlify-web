export function initEventAnalytics() {
    // Add listener for sales history button
    const btnHistory = document.getElementById('btnSalesChartHistory');
    if (btnHistory) {
        btnHistory.addEventListener('click', () => {
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (!currentEventId) {
                alert("Please select an event to view its history.");
                return;
            }
            const modal = new bootstrap.Modal(document.getElementById('salesHistoryModal'));
            modal.show();
        });
    }

    // Add listener for the new export button
    const btnExport = document.getElementById('btnExportKeyMetrics');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const exportModal = new bootstrap.Modal(document.getElementById('exportMetricsModal'));
            exportModal.show();
        });
    }

    // Add listeners for the modal's export format buttons
    const btnPdf = document.getElementById('btnExportPdf');
    if (btnPdf) {
        btnPdf.addEventListener('click', () => {
            if (!window.jspdf) {
                alert("PDF library not loaded.");
                return;
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
            const eventTitle = event ? event.title : "Event Analytics";

            // Get metrics from DOM
            const peakDay = document.getElementById('analyticsPeakDay')?.textContent || '-';
            const peakSales = document.getElementById('analyticsPeakDaySales')?.textContent || '0';
            const totalSold = document.getElementById('analyticsTotalSold')?.textContent || '0';
            const revenue = document.getElementById('analyticsTotalRevenue')?.textContent || '0';

            // Generate PDF Content
            doc.setFontSize(20);
            doc.text("Event Analytics Report", 105, 20, null, null, "center");
            
            doc.setFontSize(12);
            doc.text(`Event: ${eventTitle}`, 20, 40);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 48);
            doc.line(20, 55, 190, 55);

            doc.setFontSize(14);
            doc.text("Key Metrics", 20, 70);
            doc.setFontSize(12);
            doc.text(`Peak Sales Day: ${peakDay}`, 20, 85);
            doc.text(`Tickets on Peak Day: ${peakSales}`, 20, 95);
            doc.text(`Total Tickets Sold: ${totalSold}`, 20, 105);
            doc.text(`Total Revenue (Est.): ${revenue}`, 20, 115);

            doc.save(`analytics_${eventTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`);

            const exportModal = bootstrap.Modal.getInstance(document.getElementById('exportMetricsModal'));
            if (exportModal) {
                exportModal.hide();
            }
        });
    }

    const btnExcel = document.getElementById('btnExportExcel');
    if (btnExcel) {
        btnExcel.addEventListener('click', async () => {
            if (!window.ExcelJS) {
                alert("ExcelJS library not loaded.");
                return;
            }

            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
            const eventTitle = event ? event.title : "Event Analytics";

            // Calculate average price for fallback
            let averagePrice = 0;
            if (event && event.is_paid && event.tickets && event.tickets.length > 0) {
                const potentialRevenue = event.tickets.reduce((sum, tier) => sum + (parseFloat(tier.price || 0) * parseInt(tier.qty || 0)), 0);
                const ticketCapacity = event.tickets.reduce((sum, tier) => sum + parseInt(tier.qty || 0), 0);
                if (ticketCapacity > 0) {
                    averagePrice = potentialRevenue / ticketCapacity;
                }
            }

            const workbook = new ExcelJS.Workbook();
            
            // --- Sheet 1: Guest List ---
            const guestSheet = workbook.addWorksheet('Guest List');
            guestSheet.columns = [
                { header: 'Guest Name', key: 'name', width: 30 },
                { header: 'Email', key: 'email', width: 35 },
                { header: 'Reservation Date', key: 'res_date', width: 20 },
                { header: 'Time', key: 'time', width: 15 },
                { header: 'Ticket Price', key: 'price', width: 15 },
                { header: 'Status', key: 'status', width: 15 }
            ];
            
            // Style Header
            guestSheet.getRow(1).font = { bold: true };
            
            if (event && event.guests) {
                event.guests.forEach(guest => {
                    const ts = new Date(guest.timestamp);
                    
                    // Determine Status
                    let status = 'Reserved';
                    if (guest.checked_in) {
                        status = 'Checked-in';
                    } else {
                        const now = new Date();
                        const endDate = event.end_datetime ? new Date(event.end_datetime) : new Date(event.start_datetime);
                        if (event.status === 'completed' || event.status === 'cancelled' || now > endDate) {
                            status = 'No Show';
                        }
                    }

                    let priceDisplay = 'Free';
                    if (event.is_paid) {
                        let price = averagePrice;
                        if (guest.seat_row && event.tickets) {
                            const tier = event.tickets.find(t => t.name === guest.seat_row || t.original_name === guest.seat_row);
                            if (tier) price = parseFloat(tier.price || 0);
                        }
                        priceDisplay = price;
                    }

                    guestSheet.addRow({
                        name: guest.name,
                        email: guest.email,
                        res_date: ts.toLocaleDateString(),
                        time: ts.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                        price: priceDisplay,
                        status: status
                    });
                });
            }

            // --- Sheet 2: Key Metrics ---
            const metricsSheet = workbook.addWorksheet('Key Metrics');
            
            // Get metrics from DOM
            const peakDay = document.getElementById('analyticsPeakDay')?.textContent || '-';
            const peakSales = document.getElementById('analyticsPeakDaySales')?.textContent || '0';
            const totalSold = document.getElementById('analyticsTotalSold')?.textContent || '0';
            const revenue = document.getElementById('analyticsTotalRevenue')?.textContent || '0';

            metricsSheet.mergeCells('A1:B1');
            const titleCell = metricsSheet.getCell('A1');
            titleCell.value = 'Event Analytics Report';
            titleCell.font = { size: 16, bold: true };
            titleCell.alignment = { horizontal: 'center' };

            metricsSheet.addRow(['Event:', eventTitle]);
            metricsSheet.addRow(['Date Generated:', new Date().toLocaleDateString()]);
            metricsSheet.addRow([]); 

            const headerRow = metricsSheet.addRow(['Metric', 'Value']);
            headerRow.font = { bold: true };
            
            metricsSheet.addRow(['Peak Sales Day', peakDay]);
            metricsSheet.addRow(['Tickets on Peak Day', peakSales]);
            metricsSheet.addRow(['Total Tickets Sold', totalSold]);
            metricsSheet.addRow(['Total Revenue (Est.)', revenue]);

            metricsSheet.getColumn(1).width = 25;
            metricsSheet.getColumn(2).width = 25;

            // Generate Buffer
            const buffer = await workbook.xlsx.writeBuffer();
            
            // Create Blob and Download
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `analytics_${eventTitle.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);

            const exportModal = bootstrap.Modal.getInstance(document.getElementById('exportMetricsModal'));
            if (exportModal) {
                exportModal.hide();
            }
        });
    }

    // --- Analytics Initialization ---
    // Chart 1: Ticket Sales (Line Chart)
    const salesCtx = document.getElementById('ticketSalesChart');
    if (salesCtx) {
        // Destroy existing chart if any (to prevent canvas reuse issues)
        if (window.dashboardSalesChart) window.dashboardSalesChart.destroy();
        
        window.dashboardSalesChart = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Daily Sales',
                    data: [],
                    fill: true,
                    borderColor: 'rgb(220, 53, 69)',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1 
                        },
                        title: {
                            display: true,
                            text: 'Capacity'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false,
                        text: 'Daily Ticket Sales'
                    }
                }
            }
        });
    }

    // Chart 2: Attendee Demographics (Doughnut Chart)
    const demoCtx = document.getElementById('attendeeDemographicsChart');
    if (demoCtx) {
        if (window.dashboardDemoChart) window.dashboardDemoChart.destroy();

        window.dashboardDemoChart = new Chart(demoCtx, {
            type: 'doughnut',
            data: {
                labels: ['18-24', '25-34', '35-44', '45+'],
                datasets: [{
                    label: 'Attendee Age Group',
                    data: [300, 50, 100, 80],
                    backgroundColor: [
                        'rgba(220, 53, 69, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(13, 110, 253, 0.8)',
                        'rgba(25, 135, 84, 0.8)'
                    ],
                    hoverOffset: 4
                }]
            }
        });
    }
}

export function updateAnalytics(event) {
    const totalCapacity = parseInt(event.total_seats) || 0;

    // Update Analytics Chart (Line Chart for Sales)
    try {
        if (window.dashboardSalesChart) {
            const salesByDate = new Map();
            const labels = [];

            const startDate = new Date(event.created_at);
            startDate.setHours(0, 0, 0, 0);
            const eventDate = new Date(event.start_datetime);
            eventDate.setHours(0, 0, 0, 0);

            if (startDate <= eventDate) {
                for (let d = new Date(startDate); d <= eventDate; d.setDate(d.getDate() + 1)) {
                    const dateString = d.toISOString().split('T')[0];
                    labels.push(dateString);
                    salesByDate.set(dateString, 0);
                }
            }

            if (event.guests && event.guests.length > 0) {
                event.guests.forEach(guest => {
                    const saleDate = new Date(guest.timestamp);
                    const dateString = saleDate.toISOString().split('T')[0];
                    if (salesByDate.has(dateString)) {
                        salesByDate.set(dateString, salesByDate.get(dateString) + 1);
                    }
                });
            }

            const dataPoints = labels.map(label => salesByDate.get(label) || 0);

            window.dashboardSalesChart.data.labels = labels;
            window.dashboardSalesChart.data.datasets[0].data = dataPoints;

            if (totalCapacity > 0) {
                window.dashboardSalesChart.options.scales.y.max = totalCapacity;
            } else {
                delete window.dashboardSalesChart.options.scales.y.max;
            }

            window.dashboardSalesChart.update();

            const historyTableBody = document.getElementById('salesHistoryTableBody');
            if (historyTableBody) {
                historyTableBody.innerHTML = '';
                salesByDate.forEach((sales, date) => {
                    if (sales > 0) {
                        const row = document.createElement('tr');
                        row.innerHTML = `<td>${date}</td><td>${sales}</td>`;
                        historyTableBody.appendChild(row);
                    }
                });
                if (historyTableBody.innerHTML === '') {
                    historyTableBody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No sales data yet.</td></tr>';
                }
            }

            // --- Update Key Metrics ---
            const peakDayEl = document.getElementById('analyticsPeakDay');
            const peakDaySalesEl = document.getElementById('analyticsPeakDaySales');
            const totalSoldEl = document.getElementById('analyticsTotalSold');
            const totalRevenueEl = document.getElementById('analyticsTotalRevenue');

            if (peakDayEl && peakDaySalesEl && totalSoldEl && totalRevenueEl) {
                let peakSales = 0;
                let peakDate = '-';
                salesByDate.forEach((sales, date) => {
                    if (sales > peakSales) {
                        peakSales = sales;
                        peakDate = date;
                    }
                });

                peakDayEl.textContent = peakDate;
                peakDaySalesEl.textContent = peakSales;

                const ticketsSold = event.sold || 0;
                totalSoldEl.textContent = ticketsSold;

                let revenue = 0;
                let averagePrice = 0;

                if (event.is_paid && event.tickets && event.tickets.length > 0) {
                    const potentialRevenue = event.tickets.reduce((sum, tier) => sum + (parseFloat(tier.price || 0) * parseInt(tier.qty || 0)), 0);
                    const ticketCapacity = event.tickets.reduce((sum, tier) => sum + parseInt(tier.qty || 0), 0);
                    if (ticketCapacity > 0) {
                        averagePrice = potentialRevenue / ticketCapacity;
                    }
                }

                if (event.is_paid) {
                    if (event.guests && event.guests.length > 0) {
                        event.guests.forEach(guest => {
                            let price = averagePrice;
                            if (guest.seat_row && event.tickets) {
                                const tier = event.tickets.find(t => t.name === guest.seat_row || t.original_name === guest.seat_row);
                                if (tier) price = parseFloat(tier.price || 0);
                            }
                            revenue += price;
                        });
                    } else {
                        revenue = averagePrice * ticketsSold;
                    }
                }
                
                totalRevenueEl.textContent = event.is_paid ? `₱${revenue.toLocaleString()}` : 'N/A';
            }
        }
    } catch (e) {
        console.warn("Failed to update dashboard chart:", e);
    }
}