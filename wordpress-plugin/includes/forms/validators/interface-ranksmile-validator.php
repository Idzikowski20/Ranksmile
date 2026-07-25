<?php
/**
 * Interface for field validator.
 *
 * @package Ranksmile
 */

namespace Ranksmile\Forms\Validators;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Interface for Ranksmile Forms Validator.
 */
interface Ranksmile_Validator_Interface {

	/**
	 * Validate value.
	 *
	 * @param mixed $value - value to validate.
	 * @return bool
	 */
	public function validate( $value );

	/**
	 * Returns error message in case of validation fail.
	 *
	 * @return string.
	 */
	public function get_error();
}
