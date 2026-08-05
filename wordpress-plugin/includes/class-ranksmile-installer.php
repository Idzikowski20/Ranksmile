<?php
/**
 * Object to manage all actions needed during update or installation
 *
 * @package Ranksmile
 * @link https://ranksmile.pl
 */

namespace Ranksmile;

use Ranksmile\Upgrade\SQL\Upgrade_130;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Ranksmile Installer class.
 */
class Ranksmile_Installer {

	/**
	 * Object constructor.
	 */
	public function __construct() {
	}

	/**
	 * Runs installation actions.
	 *
	 * @return void
	 */
	public function install() {
		if ( ! is_blog_installed() ) {
			return;
		}

		// Check if we are not already running this routine.
		if ( self::is_installing() ) {
			return;
		}

		// If we made it till here nothing is running yet, lets set the transient now.
		set_transient( 'ranksmile_installing', 'yes', MINUTE_IN_SECONDS * 10 );

		self::set_activation_transients();
		self::update_ranksmile_database();
		self::make_version_related_actions();
		self::migrate_option_keys_180();
		self::send_tracking_data();
		self::update_ranksmile_version();

		delete_transient( 'ranksmile_installing' );
	}

	/**
	 * Returns true if we're installing.
	 *
	 * @return bool
	 */
	private static function is_installing() {
		return 'yes' === get_transient( 'ranksmile_installing' );
	}

	/**
	 * See if we need to set redirect transients for activation or not.
	 *
	 * @return void
	 */
	private static function set_activation_transients() {
		if ( self::is_new_install() ) {
			set_transient( '_ranksmile_activation_redirect', 1, 30 );
		}
	}

	/**
	 * Is this a brand new Ranksmile install?
	 *
	 * A brand new install has no version yet.
	 *
	 * @return boolean
	 */
	public static function is_new_install() {
		return is_null( get_option( 'ranksmile_version', null ) );
	}

	/**
	 * Create and Updates tables in database for Ranksmile purposes.
	 */
	private static function update_ranksmile_database() {

		$last_active_version = get_option( 'ranksmile_version', false );

		if ( version_compare( $last_active_version, '1.3.0', '<' ) ) {
			$updater = new Upgrade_130();
			$updater->execute();
		}
	}

	/**
	 * Make actions that are related to Ranksmile version.
	 */
	private static function make_version_related_actions() {

		$last_active_version = get_option( 'ranksmile_version', false );

		if ( version_compare( $last_active_version, '1.3.0', '<' ) ) {
			// Transfer GSC data to new format.
			Ranksmile()->get_plugin()->get_gsc()->transfer_gsc_data_to_new_format();
		}
	}

	/**
	 * Update Ranksmile version to current.
	 *
	 * @return void
	 */

	/**
	 * One-shot option key migration for 1.8 (copy → delete).
	 */
	private static function migrate_option_keys_180() {
		$last = get_option( 'ranksmile_version', false );
		if ( $last && version_compare( (string) $last, '1.8.0', '>=' ) ) {
			return;
		}
		$map = array(
			'wpranksmile_api_access_key' => 'ranksmile_api_access_key',
		);
		foreach ( $map as $old => $new ) {
			$val = get_option( $old, null );
			if ( null === $val || false === $val ) {
				continue;
			}
			if ( false === get_option( $new, false ) ) {
				update_option( $new, $val, false );
			}
			delete_option( $old );
		}
	}

	private static function update_ranksmile_version() {
		update_option( 'ranksmile_version', Ranksmile()->version );
	}

	/**
	 * Sends tracking data to Ranksmile if user allowed it and Ranksmile was updated.
	 *
	 * @return void
	 */
	public static function send_tracking_data() {
		$previous_version = get_option( 'ranksmile_version', false );

		if ( ! $previous_version || Ranksmile()->version != $previous_version ) {
			return;
		}

		Ranksmile()->get_ranksmile_tracking()->track_wp_environment();
	}


	/**
	 * Set transient when Ranksmile is updated.
	 *
	 * @param object $upgrader_object - Upgrader object.
	 * @param array  $options - Options array.
	 */
	public function ranksmile_upgrade_completed( $upgrader_object, $options ) {
		$our_plugin = Ranksmile()->get_basedir();

		if ( 'update' === $options['action'] && 'plugin' === $options['type'] && isset( $options['plugins'] ) ) {
			foreach ( $options['plugins'] as $plugin ) {
				if ( $plugin === $our_plugin ) {
					set_transient( 'ranksmile_updated', 1 );
				}
			}
		}
	}
}
