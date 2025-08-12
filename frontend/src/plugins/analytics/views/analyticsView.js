// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Backbone = require('backbone');
  var Handlebars = require('handlebars');
  var OriginView = require('core/views/originView');
  var Origin = require('core/origin');

  var AnalyticsView = OriginView.extend({
    tagName: 'div',
    className: 'analytics',
    events: {
      'submit #analytics-activity-form': 'onFormSubmit'
    },

    preRender: function () {
      this.listenTo(this.model, 'invalid', this.handleValidationError);
    },

    postRender: function () {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const formattedDate = `${yyyy}-${mm}-${dd}`;
      this.$('#start-date').val(formattedDate);
      this.$('#end-date').val(formattedDate);
      this.onFormSubmit(new Event('submit'));
    },

    onFormSubmit: function (e) {
      e.preventDefault();

      const startDate = this.$('#start-date').val(); // format: YYYY-MM-DD
      const endDate = this.$('#end-date').val();
      const interval = this.$('#interval').val();

      if (!startDate || !endDate || !interval) {
        alert('Please fill out all fields.');
        return;
      }

      // Get user's IANA timezone (e.g. "America/Toronto")
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const requestData = {
        startDate: startDate,       // Local date string
        endDate: endDate,           // Local date string
        interval: interval,
        timezone: timezone          // IANA timezone string
      };

      console.log('Requesting analytics activity with:', requestData);

      $.ajax({
        url: '/api/analytics/activeUsers',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(requestData),
        success: (response) => {
          console.log('Analytics activity data received:', response);
          this.renderResults(response);
        },
        error: (err) => {
          console.error('Analytics activity request failed:', err);
        }
      });
    },


    hexToRgba: function (hex, opacity) {
      hex = hex.replace(/^#/, '');
      if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
      }
      const bigint = parseInt(hex, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    },

    renderResults: function (data) {
      const ctx = this.$('#analytics-chart')[0].getContext('2d');
      const interval = this.$('#interval').val();

      function parseTimestamp(timestamp) {
        switch (interval) {
          case 'hourly':
            return new Date(timestamp + ':00:00Z'); // force UTC
          case 'daily':
            return new Date(timestamp + 'T00:00:00Z');
          case 'weekly': {
            const [year, week] = timestamp.split('-W').map(Number);
            // ISO week starts on Monday
            const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
            const dayOfWeek = simple.getUTCDay();
            const isoMonday = new Date(simple);
            isoMonday.setUTCDate(simple.getUTCDate() - ((dayOfWeek + 6) % 7));

            return isoMonday;
          }
          case 'monthly':
            return new Date(timestamp + '-01T00:00:00Z');
          case 'yearly':
            return new Date(timestamp + '-01-01T00:00:00Z');
          default:
            return new Date(timestamp);
        }
      }

      function formatLabel(date) {
        switch (interval) {
          case 'hourly': {
            const day = date.getDate().toString().padStart(2, '0');
            const hour = date.getHours().toString().padStart(2, '0');
            return `${day}T${hour}`;
          }
          case 'daily': {
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${month}/${day}`;
          }
          case 'weekly': {
            const year = date.getFullYear();
            const week = getWeekNumber(date);
            return `${year} W${week}`;
          }
          case 'monthly': {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${year}/${month}`;
          }
          case 'yearly':
            return date.getFullYear().toString();
          default:
            return date.toLocaleDateString();
        }
      }

      function getWeekNumber(date) {
        const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = tempDate.getUTCDay() || 7;
        tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
        return Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
      }

      const parsedDates = data.map(entry => parseTimestamp(entry.timestamp));
      const labels = parsedDates.map(date => formatLabel(date));
      const values = data.map(entry => entry.activeUsers);

      if (this.chart) {
        this.chart.destroy();
      }

      const lineColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-line-color').trim();
      const lineColorRGBA = this.hexToRgba(lineColor, 1);
      const fillColorRGBA = this.hexToRgba(lineColor, 0.2);

      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: interval === 'hourly' ? 'Active Users' : 'Active Users (Average)',
            data: values,
            borderColor: lineColorRGBA,
            backgroundColor: fillColorRGBA,
            fill: true,
            tension: 0.3,
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          legend: {
            display: false
          },
          tooltips: {
            mode: 'index',
            intersect: false,
            callbacks: {
              title: function (tooltipItems) {
                const index = tooltipItems[0].index;
                const localDate = parsedDates[index];
                const interval = $('#interval').val(); // Get current interval

                switch (interval) {
                  case 'daily':
                    return localDate.toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    });
                  case 'weekly':
                    return `Week of ${localDate.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}`;
                  case 'monthly':
                    return localDate.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short'
                    });
                  case 'yearly':
                    return localDate.getFullYear().toString();
                  default:
                    return localDate.toLocaleString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZoneName: 'short'
                    });
                }
              }
            }
          },
          scales: {
            xAxes: [{
              ticks: {
                maxRotation: 90,
                minRotation: 0
              },
              scaleLabel: {
                display: true,
                labelString: 'Time'
              }
            }],
            yAxes: [{
              ticks: {
                beginAtZero: true
              },
              scaleLabel: {
                display: true,
                labelString: 'Active Users'
              }
            }]
          }
        }
      });
    },

    handleValidationError: function (model, error) {
      Origin.trigger('sidebar:resetButtons');
      if (error && _.keys(error).length !== 0) {
        _.each(error, function (value, key) {
          this.$('#' + key + 'Error').text(value);
        }, this);
        this.$('.error-text').removeClass('display-none');
      }
    }
  }, {
    template: 'analytics'
  });

  return AnalyticsView;
});
