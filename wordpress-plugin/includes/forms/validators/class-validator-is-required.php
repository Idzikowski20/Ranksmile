<?php
/**
 * Is Required Validator.
 *
 * @package Ranksmile
 */

namespace Ranksmile\Forms\Validators;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validator to check if field is required.
 */
class Validator_Is_Required implements Ranksmile_Validator_Interface {

	/**
	 * Validate value.
	 *
	 * @param mixed $value - value to validate.
	 * @return bool
	 */
	public function validate( $value ) {
		if ( isset( $value ) && '' !== $value && ! empty( $value ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Returns error message in case of validation fail.
	 *
	 * @return string.
	 */
	public function get_error() {
		return __( 'This field is required.', 'ranksmileseo' );
	}
}
