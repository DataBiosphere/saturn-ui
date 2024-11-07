import Highcharts from 'highcharts'; // Highcharts is being used under the Creative Commons Attribution-NonCommercial 3.0 license
import highchartsAccessibility from 'highcharts/modules/accessibility';
import highchartsExporting from 'highcharts/modules/exporting';
import HighchartsReact from 'highcharts-react-official';
import { h } from 'react-hyperscript-helpers';

highchartsAccessibility(Highcharts);
highchartsExporting(Highcharts);
// We do not (and should not) transform user input into links or other HTML using Highcharts;
// this is needed to permit use of internally constructed links in a Highcharts formatter
Highcharts.AST.bypassHTMLFiltering = true;

export const Chart = ({ options }) => h(HighchartsReact, { highcharts: Highcharts, options });
