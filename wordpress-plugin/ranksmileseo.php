<?php
/**
 * Plugin Name: Ranksmile – WordPress Plugin
 * Plugin URI: https://wordpress.org/plugins/ranksmileseo/
 * Description: Create content that ranks with Ranksmile in WordPress
 * Version: 1.7.0.640
 * Author: Ranksmile
 * Author URI: https://ranksmile.pl
 * License: GPLv2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: ranksmileseo
 * Requires at least: 6.0
 * Test up to: 6.9
 * Requires PHP: 7.4
 *
 * @package Ranksmile
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'RANKSMILE_VERSION' ) ) {
	define( 'RANKSMILE_VERSION', '1.7.0.640' );
}

if ( ! defined( 'RANKSMILE_PLUGIN_FILE' ) ) {
	define( 'RANKSMILE_PLUGIN_FILE', __FILE__ );
}

use Ranksmile\Ranksmileseo;

if ( ! class_exists( 'Ranksmileseo' ) ) {
	require_once __DIR__ . '/includes/class-ranksmileseo.php';
	$ranksmileseo = Ranksmileseo::get_instance();
}


if ( ! ( function_exists( 'Ranksmile' ) ) ) {
	/**
	 * Returns the main instance of Ranksmileseo
	 *
	 * @return Ranksmileseo
	 */
	function Ranksmile() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.FunctionNameInvalid
		return Ranksmileseo::get_instance();
	}
}

register_uninstall_hook( __FILE__, 'ranksmileseo_uninstall_hook' );

/**
 * Clears after uninstall.
 */
function ranksmileseo_uninstall_hook() {
	wp_cache_flush();

	// Delete all Ranksmile options (keep only connection details).
	delete_option( 'ranksmile_notification_dismissals' );

	delete_transient( 'ranksmile_tracking_first_enabled' );
	delete_transient( 'ranksmile_gsc_weekly_report_email_sent' );
	delete_option( 'ranksmile_connection_token' );

	// Clear crons.
	wp_clear_scheduled_hook( 'ranksmile_gather_available_locations' );
	wp_clear_scheduled_hook( 'ranksmile_gather_posts_traffic' );
	wp_clear_scheduled_hook( 'ranksmile_gather_position_monitor_data' );
	wp_clear_scheduled_hook( 'ranksmile_gather_drop_monitor_data' );
}
